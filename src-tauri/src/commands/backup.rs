use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Manager};

const DB_FILE_NAME: &str = "mitsumori-desk.db";
const BACKUPS_DIR_NAME: &str = "backups";
const SIDECAR_SUFFIXES: [&str; 3] = ["-wal", "-shm", "-journal"];
const MANIFEST_SUFFIX: &str = ".manifest.json";
const BACKUP_FORMAT_VERSION: u32 = 1;
// 生きているDBへ問い合わせる際、直近の書き込みトランザクションと競合しても
// 待ってから読み取れるようにする(即座にSQLITE_BUSYで失敗させない)。
const BUSY_TIMEOUT: Duration = Duration::from_millis(5000);

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct BackupManifest {
    pub backup_format_version: u32,
    pub app_version: String,
    pub schema_version: Option<i64>,
    pub created_at_unix: u64,
    pub os: String,
}

#[derive(serde::Serialize)]
pub struct BackupInfo {
    pub file_name: String,
    pub size_bytes: u64,
    pub schema_version: Option<i64>,
    pub app_version: Option<String>,
    pub created_at_unix: Option<u64>,
    pub os: Option<String>,
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

fn manifest_path(backup_path: &Path) -> PathBuf {
    append_suffix(backup_path, MANIFEST_SUFFIX)
}

fn remove_if_exists(path: &Path) {
    if path.exists() {
        let _ = fs::remove_file(path);
    }
}

// -wal/-shm/-journalはsqliteの内部状態を含むため、存在する場合のみ一緒に複製する。
// 復元済みバックアップファイル(既に整合性検証済みの静的ファイル)を書き込み先へ
// 反映する際にのみ使う。生きているDBを読み取る場合はvacuum_intoを使うこと。
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

// SQLiteのVACUUM INTOを使い、ジャーナルモード(WAL/ロールバックジャーナル問わず)や
// 書き込み中かどうかに関わらず、その時点で一貫した単一ファイルのスナップショットを
// 作成する。生きているDB(アプリが読み書きしている可能性があるDB)を安全に複製する
// ために、fs::copyによる素朴なファイルコピーの代わりにこちらを使う。
fn vacuum_into(source: &Path, dest: &Path) -> Result<(), String> {
    if dest.exists() {
        return Err("バックアップ先に同名のファイルが既に存在します".to_string());
    }
    let conn =
        rusqlite::Connection::open_with_flags(source, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
            .map_err(|error| format!("データベースを開けませんでした: {error}"))?;
    conn.busy_timeout(BUSY_TIMEOUT)
        .map_err(|error| format!("データベースの待機設定に失敗しました: {error}"))?;
    let dest_str = dest
        .to_str()
        .ok_or_else(|| "バックアップ先のパスが不正です".to_string())?;
    conn.execute("VACUUM INTO ?1", [dest_str])
        .map_err(|error| format!("バックアップの作成に失敗しました: {error}"))?;
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

fn unix_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
}

fn write_manifest(backup_path: &Path, manifest: &BackupManifest) -> Result<(), String> {
    let json = serde_json::to_string_pretty(manifest)
        .map_err(|error| format!("メタデータの作成に失敗しました: {error}"))?;
    fs::write(manifest_path(backup_path), json)
        .map_err(|error| format!("メタデータの保存に失敗しました: {error}"))
}

fn read_manifest(backup_path: &Path) -> Option<BackupManifest> {
    let text = fs::read_to_string(manifest_path(backup_path)).ok()?;
    serde_json::from_str(&text).ok()
}

fn build_manifest(app: &AppHandle, schema_version: Option<i64>) -> BackupManifest {
    BackupManifest {
        backup_format_version: BACKUP_FORMAT_VERSION,
        app_version: app.package_info().version.to_string(),
        schema_version,
        created_at_unix: unix_now(),
        os: std::env::consts::OS.to_string(),
    }
}

fn backup_info_from_manifest(file_name: String, size_bytes: u64, path: &Path) -> BackupInfo {
    let manifest = read_manifest(path);
    BackupInfo {
        file_name,
        size_bytes,
        schema_version: manifest
            .as_ref()
            .and_then(|manifest| manifest.schema_version)
            .or_else(|| read_schema_version(path)),
        app_version: manifest
            .as_ref()
            .map(|manifest| manifest.app_version.clone()),
        created_at_unix: manifest.as_ref().map(|manifest| manifest.created_at_unix),
        os: manifest.as_ref().map(|manifest| manifest.os.clone()),
    }
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

fn reject_unsafe_file_name(file_name: &str) -> Result<(), String> {
    if file_name.contains('/') || file_name.contains('\\') || file_name.contains("..") {
        return Err("不正なバックアップファイル名です".to_string());
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

    vacuum_into(&db, &dest)?;

    if let Err(error) = verify_backup_integrity(&dest) {
        remove_if_exists(&dest);
        return Err(format!(
            "作成したバックアップの整合性確認に失敗しました: {error}"
        ));
    }

    let manifest = build_manifest(&app, read_schema_version(&dest));
    if let Err(error) = write_manifest(&dest, &manifest) {
        remove_if_exists(&dest);
        return Err(error);
    }

    let size_bytes = fs::metadata(&dest)
        .map(|metadata| metadata.len())
        .unwrap_or(0);
    Ok(BackupInfo {
        file_name,
        size_bytes,
        schema_version: manifest.schema_version,
        app_version: Some(manifest.app_version),
        created_at_unix: Some(manifest.created_at_unix),
        os: Some(manifest.os),
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
        backups.push(backup_info_from_manifest(
            file_name.to_string(),
            size_bytes,
            &path,
        ));
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
    reject_unsafe_file_name(&backup_file_name)?;
    let backup_path = dir.join(&backup_file_name);
    verify_backup_integrity(&backup_path)?;

    let db = db_path(&app)?;
    let pre_restore_label = sanitize_label(&pre_restore_label)?;
    let pre_restore_path = dir.join(format!("mitsumori-desk-backup-{pre_restore_label}.db"));

    if db.exists() {
        // 復元前退避も、生きているDBを読み取るためvacuum_intoで一貫したスナップショットを取る。
        // ここで失敗、または退避データの整合性検証に失敗した場合は復元自体を開始しない。
        vacuum_into(&db, &pre_restore_path)?;
        if let Err(error) = verify_backup_integrity(&pre_restore_path) {
            remove_if_exists(&pre_restore_path);
            return Err(format!(
                "復元前の退避データの検証に失敗したため、復元を中止しました: {error}"
            ));
        }
        let manifest = build_manifest(&app, read_schema_version(&pre_restore_path));
        // メタデータの保存に失敗しても、退避データ自体は検証済みで有効なため復元は継続する。
        let _ = write_manifest(&pre_restore_path, &manifest);
    }

    remove_if_exists(&append_suffix(&db, "-wal"));
    remove_if_exists(&append_suffix(&db, "-shm"));
    remove_if_exists(&append_suffix(&db, "-journal"));
    remove_if_exists(&db);

    if let Err(copy_error) = copy_with_sidecars(&backup_path, &db) {
        // 復元に失敗した場合は直前に退避したデータへロールバックし、既存データを失わないようにする
        if pre_restore_path.exists() {
            remove_if_exists(&db);
            let _ = copy_with_sidecars(&pre_restore_path, &db);
        }
        return Err(format!(
            "復元に失敗したため元の状態へ戻しました: {copy_error}"
        ));
    }

    Ok(())
}

// バックアップを外部フォルダ(購入者が選んだ任意の保存先)へコピーする。
// メタデータ(manifest.json)も存在すれば一緒に持ち出す。
#[tauri::command]
pub fn export_backup_to(
    app: AppHandle,
    backup_file_name: String,
    destination_path: String,
) -> Result<(), String> {
    reject_unsafe_file_name(&backup_file_name)?;
    let dir = backups_dir(&app)?;
    let source = dir.join(&backup_file_name);
    verify_backup_integrity(&source)?;

    let destination = PathBuf::from(&destination_path);
    if destination.exists() {
        return Err("出力先に同名のファイルが既に存在します".to_string());
    }
    copy_with_sidecars(&source, &destination)?;
    let manifest_source = manifest_path(&source);
    if manifest_source.exists() {
        let _ = fs::copy(&manifest_source, manifest_path(&destination));
    }
    Ok(())
}

// 外部フォルダ(他のパソコンや外部ドライブ)にあるバックアップファイルを、
// このアプリのバックアップフォルダへ取り込む。取り込み前に整合性を検証し、
// このアプリのバックアップファイルでない場合は取り込まない。
#[tauri::command]
pub fn import_backup_from(
    app: AppHandle,
    source_path: String,
    label: String,
) -> Result<BackupInfo, String> {
    let source = PathBuf::from(&source_path);
    verify_backup_integrity(&source)?;

    let dir = backups_dir(&app)?;
    let sanitized_label = sanitize_label(&label)?;
    let file_name = format!("mitsumori-desk-backup-{sanitized_label}.db");
    let dest = dir.join(&file_name);
    if dest.exists() {
        return Err("同名のバックアップが既に存在します".to_string());
    }
    copy_with_sidecars(&source, &dest)?;
    let manifest_source = manifest_path(&source);
    if manifest_source.exists() {
        let _ = fs::copy(&manifest_source, manifest_path(&dest));
    }

    let size_bytes = fs::metadata(&dest)
        .map(|metadata| metadata.len())
        .unwrap_or(0);
    Ok(backup_info_from_manifest(file_name, size_bytes, &dest))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn temp_dir(label: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "mitsumori-desk-backup-test-{label}-{}-{}",
            std::process::id(),
            unix_now()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write_minimal_sqlite_file(path: &Path, with_app_settings_table: bool) {
        let conn = rusqlite::Connection::open(path).unwrap();
        if with_app_settings_table {
            conn.execute("CREATE TABLE app_settings (id INTEGER PRIMARY KEY)", [])
                .unwrap();
            conn.execute(
                "CREATE TABLE _sqlx_migrations (version INTEGER PRIMARY KEY)",
                [],
            )
            .unwrap();
            conn.execute("INSERT INTO _sqlx_migrations (version) VALUES (4)", [])
                .unwrap();
        } else {
            conn.execute("CREATE TABLE unrelated (id INTEGER PRIMARY KEY)", [])
                .unwrap();
        }
    }

    #[test]
    fn verify_backup_integrity_accepts_a_valid_app_database() {
        let dir = temp_dir("ok");
        let path = dir.join("backup.db");
        write_minimal_sqlite_file(&path, true);
        assert!(verify_backup_integrity(&path).is_ok());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn verify_backup_integrity_rejects_a_database_without_app_tables() {
        let dir = temp_dir("wrong-schema");
        let path = dir.join("backup.db");
        write_minimal_sqlite_file(&path, false);
        assert!(verify_backup_integrity(&path).is_err());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn verify_backup_integrity_rejects_a_corrupted_file() {
        let dir = temp_dir("corrupt");
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

    #[test]
    fn vacuum_into_produces_a_consistent_valid_copy() {
        let dir = temp_dir("vacuum-ok");
        let source = dir.join("live.db");
        write_minimal_sqlite_file(&source, true);
        let dest = dir.join("copy.db");

        vacuum_into(&source, &dest).unwrap();

        assert!(verify_backup_integrity(&dest).is_ok());
        assert_eq!(read_schema_version(&dest), Some(4));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn vacuum_into_rejects_when_destination_already_exists() {
        let dir = temp_dir("vacuum-collision");
        let source = dir.join("live.db");
        write_minimal_sqlite_file(&source, true);
        let dest = dir.join("copy.db");
        fs::write(&dest, b"already here").unwrap();

        assert!(vacuum_into(&source, &dest).is_err());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn manifest_round_trips_through_write_and_read() {
        let dir = temp_dir("manifest");
        let backup_path = dir.join("backup.db");
        fs::write(&backup_path, b"placeholder").unwrap();
        let manifest = BackupManifest {
            backup_format_version: BACKUP_FORMAT_VERSION,
            app_version: "0.1.0".to_string(),
            schema_version: Some(4),
            created_at_unix: 1_700_000_000,
            os: "linux".to_string(),
        };

        write_manifest(&backup_path, &manifest).unwrap();
        let loaded = read_manifest(&backup_path).unwrap();

        assert_eq!(loaded.app_version, "0.1.0");
        assert_eq!(loaded.schema_version, Some(4));
        assert_eq!(loaded.created_at_unix, 1_700_000_000);
        assert_eq!(loaded.os, "linux");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn read_manifest_returns_none_when_missing() {
        let dir = temp_dir("manifest-missing");
        let backup_path = dir.join("backup.db");
        fs::write(&backup_path, b"placeholder").unwrap();

        assert!(read_manifest(&backup_path).is_none());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn reject_unsafe_file_name_blocks_path_traversal() {
        assert!(reject_unsafe_file_name("../etc/passwd").is_err());
        assert!(reject_unsafe_file_name("a/b.db").is_err());
        assert!(reject_unsafe_file_name("a\\b.db").is_err());
        assert!(reject_unsafe_file_name("normal-backup.db").is_ok());
    }
}
