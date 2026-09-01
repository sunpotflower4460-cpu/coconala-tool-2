use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Manager};

use super::backup::{app_config_dir, db_path, BackupManifest};
use crate::current_schema_version;
use crate::io_errors::{classify_rusqlite_error, classify_std_io_error, format_operation_io_error};

const BACKUPS_DIR_NAME: &str = "backups";
const SIDECAR_SUFFIXES: [&str; 3] = ["-wal", "-shm", "-journal"];
const MANIFEST_SUFFIX: &str = ".manifest.json";
const BUSY_TIMEOUT: Duration = Duration::from_millis(5000);

fn append_suffix(path: &Path, suffix: &str) -> PathBuf {
    let mut os_string = path.as_os_str().to_owned();
    os_string.push(suffix);
    PathBuf::from(os_string)
}

fn manifest_path(path: &Path) -> PathBuf {
    append_suffix(path, MANIFEST_SUFFIX)
}

fn remove_if_exists(path: &Path) {
    if path.exists() {
        let _ = fs::remove_file(path);
    }
}

fn remove_database_artifacts(path: &Path) {
    remove_if_exists(path);
    for suffix in SIDECAR_SUFFIXES {
        remove_if_exists(&append_suffix(path, suffix));
    }
}

fn copy_with_sidecars(source: &Path, dest: &Path) -> Result<(), String> {
    fs::copy(source, dest).map_err(|error| {
        format_operation_io_error("ファイルのコピーに失敗しました", classify_std_io_error(&error))
    })?;

    for suffix in SIDECAR_SUFFIXES {
        let source_sidecar = append_suffix(source, suffix);
        if source_sidecar.exists() {
            let dest_sidecar = append_suffix(dest, suffix);
            fs::copy(&source_sidecar, &dest_sidecar).map_err(|error| {
                format_operation_io_error(
                    "付随ファイルのコピーに失敗しました",
                    classify_std_io_error(&error),
                )
            })?;
        }
    }
    Ok(())
}

fn vacuum_into(source: &Path, dest: &Path) -> Result<(), String> {
    if dest.exists() {
        return Err("バックアップ先に同名のファイルが既に存在します".to_string());
    }

    let conn = rusqlite::Connection::open_with_flags(
        source,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
    )
    .map_err(|error| {
        format_operation_io_error(
            "データベースを開けませんでした",
            classify_rusqlite_error(&error, None),
        )
    })?;
    conn.busy_timeout(BUSY_TIMEOUT)
        .map_err(|_| "データベースの待機設定に失敗しました".to_string())?;

    let dest_str = dest
        .to_str()
        .ok_or_else(|| "バックアップ先のパスが不正です".to_string())?;
    conn.execute("VACUUM INTO ?1", [dest_str]).map_err(|error| {
        format_operation_io_error(
            "バックアップの作成に失敗しました",
            classify_rusqlite_error(&error, Some(dest)),
        )
    })?;
    Ok(())
}

fn read_schema_version(path: &Path) -> Option<i64> {
    let conn = rusqlite::Connection::open_with_flags(
        path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
    )
    .ok()?;
    conn.query_row("SELECT MAX(version) FROM _sqlx_migrations", [], |row| row.get(0))
        .ok()
}

fn verify_app_database(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Err("バックアップファイルが見つかりません".to_string());
    }
    let size = fs::metadata(path)
        .map_err(|error| {
            format_operation_io_error(
                "バックアップファイルの情報を取得できませんでした",
                classify_std_io_error(&error),
            )
        })?
        .len();
    if size == 0 {
        return Err("バックアップファイルが空です".to_string());
    }

    let conn = rusqlite::Connection::open_with_flags(
        path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
    )
    .map_err(|_| "バックアップファイルを開けませんでした(壊れている可能性があります)".to_string())?;

    let integrity: String = conn
        .query_row("PRAGMA integrity_check", [], |row| row.get(0))
        .map_err(|_| "バックアップファイルの整合性を確認できませんでした".to_string())?;
    if integrity != "ok" {
        return Err(format!("バックアップファイルが壊れています: {integrity}"));
    }

    let has_app_settings: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'app_settings'",
            [],
            |row| row.get(0),
        )
        .map_err(|_| "バックアップファイルの構造を確認できませんでした".to_string())?;
    if has_app_settings == 0 {
        return Err("このアプリのバックアップファイルではないようです".to_string());
    }

    if let Some(version) = read_schema_version(path) {
        if version > current_schema_version() {
            return Err(
                "このバックアップは新しいバージョンのアプリで作成されています。アプリを更新してから復元してください"
                    .to_string(),
            );
        }
    }

    Ok(())
}

fn reject_unsafe_file_name(file_name: &str) -> Result<(), String> {
    if file_name.contains('/') || file_name.contains('\\') || file_name.contains("..") {
        return Err("不正なバックアップファイル名です".to_string());
    }
    Ok(())
}

fn sanitize_label(label: &str) -> Result<String, String> {
    let sanitized: String = label
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .collect();
    if sanitized.is_empty() {
        return Err("バックアップの名前が不正です".to_string());
    }
    Ok(sanitized)
}

fn unix_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
}

fn write_pre_restore_manifest(app: &AppHandle, backup_path: &Path) -> Result<(), String> {
    let manifest = BackupManifest {
        backup_format_version: 1,
        app_version: app.package_info().version.to_string(),
        schema_version: read_schema_version(backup_path),
        created_at_unix: unix_now(),
        os: std::env::consts::OS.to_string(),
    };
    let json = serde_json::to_string_pretty(&manifest)
        .map_err(|error| format!("メタデータの作成に失敗しました: {error}"))?;
    fs::write(manifest_path(backup_path), json).map_err(|error| {
        format_operation_io_error(
            "メタデータの保存に失敗しました",
            classify_std_io_error(&error),
        )
    })
}

fn restore_pre_restore_backup(pre_restore_path: &Path, db: &Path) -> Result<(), String> {
    remove_database_artifacts(db);
    copy_with_sidecars(pre_restore_path, db)?;
    verify_app_database(db).map_err(|error| format!("復旧後データの検証に失敗しました: {error}"))
}

fn install_backup_with_rollback(
    backup_path: &Path,
    db: &Path,
    pre_restore_path: Option<&Path>,
) -> Result<(), String> {
    remove_database_artifacts(db);

    let install_result = copy_with_sidecars(backup_path, db)
        .and_then(|_| verify_app_database(db).map_err(|error| format!("復元後データの検証に失敗しました: {error}")));

    match install_result {
        Ok(()) => Ok(()),
        Err(restore_error) => {
            remove_database_artifacts(db);
            let Some(pre_restore_path) = pre_restore_path else {
                return Err(format!(
                    "復元に失敗しました。復元前のデータは存在しなかったため、自動復旧の対象はありません: {restore_error}"
                ));
            };

            match restore_pre_restore_backup(pre_restore_path, db) {
                Ok(()) => Err(format!(
                    "復元に失敗しましたが、復元前の状態へ戻しました: {restore_error}"
                )),
                Err(rollback_error) => {
                    remove_database_artifacts(db);
                    let preserved_name = pre_restore_path
                        .file_name()
                        .and_then(|name| name.to_str())
                        .unwrap_or("復元前バックアップ");
                    Err(format!(
                        "復元に失敗し、自動復旧にも失敗しました。復元前バックアップ「{preserved_name}」はバックアップ一覧に保全されています。アプリを終了し、このバックアップを削除せずサポートへ連絡してください。復元エラー: {restore_error} / 自動復旧エラー: {rollback_error}"
                    ))
                }
            }
        }
    }
}

#[tauri::command]
pub fn restore_database(
    app: AppHandle,
    backup_file_name: String,
    pre_restore_label: String,
) -> Result<(), String> {
    reject_unsafe_file_name(&backup_file_name)?;

    let backups_dir = app_config_dir(&app)?.join(BACKUPS_DIR_NAME);
    fs::create_dir_all(&backups_dir)
        .map_err(|_| "バックアップフォルダを作成できませんでした".to_string())?;

    let backup_path = backups_dir.join(&backup_file_name);
    verify_app_database(&backup_path)?;

    let db = db_path(&app)?;
    let pre_restore_label = sanitize_label(&pre_restore_label)?;
    let pre_restore_path = backups_dir.join(format!(
        "mitsumori-desk-backup-{pre_restore_label}.db"
    ));

    let rollback_source = if db.exists() {
        vacuum_into(&db, &pre_restore_path)?;
        if let Err(error) = verify_app_database(&pre_restore_path) {
            remove_if_exists(&pre_restore_path);
            return Err(format!(
                "復元前の退避データの検証に失敗したため、復元を中止しました: {error}"
            ));
        }
        // 旧実装と同様、manifest保存はbest effort。DB本体は検証済みなので失敗しても復元は継続する。
        let _ = write_pre_restore_manifest(&app, &pre_restore_path);
        Some(pre_restore_path.as_path())
    } else {
        None
    };

    install_backup_with_rollback(&backup_path, &db, rollback_source)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(label: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "mitsumori-safe-restore-{label}-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write_app_db(path: &Path, marker: &str) {
        let conn = rusqlite::Connection::open(path).unwrap();
        conn.execute("CREATE TABLE app_settings (id INTEGER PRIMARY KEY)", [])
            .unwrap();
        conn.execute_batch(
            r#"
            CREATE TABLE _sqlx_migrations (
                version BIGINT PRIMARY KEY,
                description TEXT NOT NULL,
                installed_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                success BOOLEAN NOT NULL,
                checksum BLOB NOT NULL,
                execution_time BIGINT NOT NULL
            );
            CREATE TABLE restore_marker (value TEXT NOT NULL);
            "#,
        )
        .unwrap();
        let checksum = [0u8; 48];
        conn.execute(
            "INSERT INTO _sqlx_migrations (version, description, success, checksum, execution_time) VALUES (?1, 'test', 1, ?2, 0)",
            rusqlite::params![current_schema_version(), checksum.as_slice()],
        )
        .unwrap();
        conn.execute("INSERT INTO restore_marker(value) VALUES (?1)", [marker])
            .unwrap();
    }

    fn marker(path: &Path) -> String {
        let conn = rusqlite::Connection::open(path).unwrap();
        conn.query_row("SELECT value FROM restore_marker LIMIT 1", [], |row| row.get(0))
            .unwrap()
    }

    #[test]
    fn successful_install_is_verified_before_success() {
        let dir = temp_dir("success");
        let backup = dir.join("backup.db");
        let db = dir.join("live.db");
        write_app_db(&backup, "new");
        write_app_db(&db, "old");

        install_backup_with_rollback(&backup, &db, None).unwrap();
        assert_eq!(marker(&db), "new");
        assert!(verify_app_database(&db).is_ok());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn failed_restore_reports_rollback_only_after_verified_rollback() {
        let dir = temp_dir("rollback-ok");
        let missing_backup = dir.join("missing.db");
        let db = dir.join("live.db");
        let pre_restore = dir.join("pre-restore.db");
        write_app_db(&db, "old-live");
        write_app_db(&pre_restore, "old-safe");

        let error = install_backup_with_rollback(&missing_backup, &db, Some(&pre_restore)).unwrap_err();
        assert!(error.contains("復元前の状態へ戻しました"));
        assert!(!error.contains("自動復旧にも失敗"));
        assert_eq!(marker(&db), "old-safe");
        assert!(verify_app_database(&db).is_ok());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn failed_rollback_never_claims_that_data_was_restored() {
        let dir = temp_dir("rollback-fail");
        let missing_backup = dir.join("missing.db");
        let db = dir.join("live.db");
        let invalid_pre_restore = dir.join("pre-restore-directory");
        fs::create_dir_all(&invalid_pre_restore).unwrap();
        write_app_db(&db, "old-live");

        let error = install_backup_with_rollback(
            &missing_backup,
            &db,
            Some(&invalid_pre_restore),
        )
        .unwrap_err();
        assert!(error.contains("自動復旧にも失敗しました"));
        assert!(!error.contains("復元前の状態へ戻しました"));
        assert!(error.contains("pre-restore-directory"));
        let _ = fs::remove_dir_all(&dir);
    }
}
