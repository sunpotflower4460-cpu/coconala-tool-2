use std::fs;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

const DB_FILE_NAME: &str = "mitsumori-desk.db";
const BACKUPS_DIR_NAME: &str = "backups";
const SIDECAR_SUFFIXES: [&str; 3] = ["-wal", "-shm", "-journal"];

#[derive(serde::Serialize)]
pub struct BackupInfo {
    pub file_name: String,
    pub size_bytes: u64,
    pub schema_version: Option<i64>,
}

pub(crate) fn app_config_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map_err(|_| "アプリのデータフォルダを取得できませんでした".to_string())
}

pub(crate) fn db_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_config_dir(app)?.join(DB_FILE_NAME))
}

fn backups_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app_config_dir(app)?.join(BACKUPS_DIR_NAME);
    fs::create_dir_all(&dir)
        .map_err(|_| "バックアップフォルダを作成できませんでした".to_string())?;
    Ok(dir)
}

fn append_suffix(path: &Path, suffix: &str) -> PathBuf {
    let mut os_string = path.as_os_str().to_owned();
    os_string.push(suffix);
    PathBuf::from(os_string)
}

fn remove_if_exists(path: &Path) {
    if path.exists() {
        let _ = fs::remove_file(path);
    }
}

// -wal/-shm/-journalはsqliteの内部状態を含むため、存在する場合のみ一緒に複製する。
fn copy_with_sidecars(source: &Path, dest: &Path) -> Result<(), String> {
    fs::copy(source, dest).map_err(|error| format!("ファイルのコピーに失敗しました: {error}"))?;
    for suffix in SIDECAR_SUFFIXES {
        let sidecar_source = append_suffix(source, suffix);
        if sidecar_source.exists() {
            let sidecar_dest = append_suffix(dest, suffix);
            fs::copy(&sidecar_source, &sidecar_dest)
                .map_err(|error| format!("付随ファイルのコピーに失敗しました: {error}"))?;
        }
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

pub(crate) fn read_schema_version(path: &Path) -> Option<i64> {
    let conn =
        rusqlite::Connection::open_with_flags(path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
            .ok()?;
    conn.query_row("SELECT MAX(version) FROM _sqlx_migrations", [], |row| {
        row.get(0)
    })
    .ok()
}

fn verify_backup_integrity(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Err("バックアップファイルが見つかりません".to_string());
    }
    let conn =
        rusqlite::Connection::open_with_flags(path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
            .map_err(|_| {
                "バックアップファイルを開けませんでした(壊れている可能性があります)".to_string()
            })?;

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

    Ok(())
}

#[tauri::command]
pub fn backup_database(app: AppHandle, label: String) -> Result<BackupInfo, String> {
    let db = db_path(&app)?;
    if !db.exists() {
        return Err("バックアップ対象のデータベースがまだ作成されていません".to_string());
    }
    let dir = backups_dir(&app)?;
    let sanitized_label = sanitize_label(&label)?;
    let file_name = format!("mitsumori-desk-backup-{sanitized_label}.db");
    let dest = dir.join(&file_name);
    if dest.exists() {
        return Err("同名のバックアップが既に存在します".to_string());
    }
    copy_with_sidecars(&db, &dest)?;
    let size_bytes = fs::metadata(&dest)
        .map(|metadata| metadata.len())
        .unwrap_or(0);
    Ok(BackupInfo {
        file_name,
        size_bytes,
        schema_version: read_schema_version(&dest),
    })
}

#[tauri::command]
pub fn list_backups(app: AppHandle) -> Result<Vec<BackupInfo>, String> {
    let dir = backups_dir(&app)?;
    let entries =
        fs::read_dir(&dir).map_err(|_| "バックアップ一覧の取得に失敗しました".to_string())?;
    let mut backups = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        let Some(file_name) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        if !file_name.ends_with(".db") {
            continue;
        }
        let size_bytes = entry.metadata().map(|metadata| metadata.len()).unwrap_or(0);
        backups.push(BackupInfo {
            file_name: file_name.to_string(),
            size_bytes,
            schema_version: read_schema_version(&path),
        });
    }
    backups.sort_by(|a, b| b.file_name.cmp(&a.file_name));
    Ok(backups)
}

#[tauri::command]
pub fn restore_database(
    app: AppHandle,
    backup_file_name: String,
    pre_restore_label: String,
) -> Result<(), String> {
    let dir = backups_dir(&app)?;
    // ファイル名のみを許可し、パストラバーサルを防ぐ
    if backup_file_name.contains('/')
        || backup_file_name.contains('\\')
        || backup_file_name.contains("..")
    {
        return Err("不正なバックアップファイル名です".to_string());
    }
    let backup_path = dir.join(&backup_file_name);
    verify_backup_integrity(&backup_path)?;

    let db = db_path(&app)?;
    let pre_restore_label = sanitize_label(&pre_restore_label)?;
    let pre_restore_path = dir.join(format!("mitsumori-desk-backup-{pre_restore_label}.db"));

    if db.exists() {
        copy_with_sidecars(&db, &pre_restore_path)?;
    }

    remove_if_exists(&append_suffix(&db, "-wal"));
    remove_if_exists(&append_suffix(&db, "-shm"));
    remove_if_exists(&append_suffix(&db, "-journal"));

    if let Err(copy_error) = copy_with_sidecars(&backup_path, &db) {
        // 復元に失敗した場合は直前に退避したデータへロールバックし、既存データを失わないようにする
        if pre_restore_path.exists() {
            let _ = copy_with_sidecars(&pre_restore_path, &db);
        }
        return Err(format!(
            "復元に失敗したため元の状態へ戻しました: {copy_error}"
        ));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn write_minimal_sqlite_file(path: &Path, with_app_settings_table: bool) {
        let conn = rusqlite::Connection::open(path).unwrap();
        if with_app_settings_table {
            conn.execute("CREATE TABLE app_settings (id INTEGER PRIMARY KEY)", [])
                .unwrap();
        } else {
            conn.execute("CREATE TABLE unrelated (id INTEGER PRIMARY KEY)", [])
                .unwrap();
        }
    }

    #[test]
    fn verify_backup_integrity_accepts_a_valid_app_database() {
        let dir = std::env::temp_dir().join(format!(
            "mitsumori-desk-backup-test-ok-{}",
            std::process::id()
        ));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("backup.db");
        write_minimal_sqlite_file(&path, true);
        assert!(verify_backup_integrity(&path).is_ok());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn verify_backup_integrity_rejects_a_database_without_app_tables() {
        let dir = std::env::temp_dir().join(format!(
            "mitsumori-desk-backup-test-wrong-schema-{}",
            std::process::id()
        ));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("backup.db");
        write_minimal_sqlite_file(&path, false);
        assert!(verify_backup_integrity(&path).is_err());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn verify_backup_integrity_rejects_a_corrupted_file() {
        let dir = std::env::temp_dir().join(format!(
            "mitsumori-desk-backup-test-corrupt-{}",
            std::process::id()
        ));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("backup.db");
        let mut file = fs::File::create(&path).unwrap();
        file.write_all(b"not a sqlite file").unwrap();
        assert!(verify_backup_integrity(&path).is_err());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn sanitize_label_rejects_path_traversal_characters() {
        assert!(sanitize_label("../../etc/passwd").unwrap() == "etcpasswd");
        assert!(sanitize_label("   ").is_err());
    }
}
