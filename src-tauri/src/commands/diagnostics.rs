use std::fs;

use tauri::AppHandle;

use super::backup::{db_path, read_schema_version};

#[derive(serde::Serialize)]
pub struct SystemDiagnostics {
    pub app_version: String,
    pub os: String,
    pub os_arch: String,
    pub db_size_bytes: u64,
    pub db_schema_version: Option<i64>,
}

// 個人情報や秘密情報を含まない、OS・アプリのバージョン情報のみを返す。
// 顧客名・会社名・APIキー等は一切扱わない。
#[tauri::command]
pub fn get_system_diagnostics(app: AppHandle) -> Result<SystemDiagnostics, String> {
    let db = db_path(&app)?;
    let db_size_bytes = fs::metadata(&db)
        .map(|metadata| metadata.len())
        .unwrap_or(0);
    Ok(SystemDiagnostics {
        app_version: app.package_info().version.to_string(),
        os: std::env::consts::OS.to_string(),
        os_arch: std::env::consts::ARCH.to_string(),
        db_size_bytes,
        db_schema_version: read_schema_version(&db),
    })
}

// 保存先はネイティブの保存ダイアログでユーザー自身が選ぶため、任意パスへの書き込みを許可してよい。
#[tauri::command]
pub fn write_text_file(path: String, content: String) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("保存先が指定されていません".to_string());
    }
    fs::write(&path, content).map_err(|error| format!("ファイルの保存に失敗しました: {error}"))
}
