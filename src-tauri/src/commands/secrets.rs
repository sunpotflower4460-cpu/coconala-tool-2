use keyring::Entry;

// OSの資格情報ストア(macOS Keychain / Windows Credential Manager / Linuxのsecret service)を
// アプリ識別子ごとの名前空間で使う。APIキーはここにのみ保存し、通常のSQLite DBへは書かない。
const SERVICE_NAME: &str = "com.mitsumoridesk.desktop";

fn build_entry(key: &str) -> Result<Entry, String> {
    Entry::new(SERVICE_NAME, key).map_err(|_| "資格情報ストアを開けませんでした".to_string())
}

#[tauri::command]
pub fn secret_get(key: String) -> Result<Option<String>, String> {
    let entry = build_entry(&key)?;
    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(_) => Err("保存された秘密情報の取得に失敗しました".to_string()),
    }
}

#[tauri::command]
pub fn secret_set(key: String, value: String) -> Result<(), String> {
    let entry = build_entry(&key)?;
    entry
        .set_password(&value)
        .map_err(|_| "秘密情報の保存に失敗しました".to_string())
}

#[tauri::command]
pub fn secret_delete(key: String) -> Result<(), String> {
    let entry = build_entry(&key)?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(_) => Err("秘密情報の削除に失敗しました".to_string()),
    }
}

// OSの資格情報ストア(D-Bus secret service / Keychain / Credential Manager)への実接続は
// 各OSのデスクトップ環境が必要なため、ここではunit testの対象にしない。
// 実機での確認手順はdocs/MANUAL_STEPS.mdを参照。
