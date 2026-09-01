use std::io::{Error as IoError, ErrorKind};
use std::path::Path;

use rusqlite::ErrorCode;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ClassifiedIoKind {
    PermissionDenied,
    NotFound,
    AlreadyExists,
    WriteZero,
    StorageFull,
    Busy,
    Generic,
}

// OS 固有の raw code はここに集約する。Windows と Unix で数値が衝突するため、
// 実行中 OS の表だけを見る。
const WINDOWS_ERROR_HANDLE_DISK_FULL: i32 = 39; // ERROR_HANDLE_DISK_FULL
const WINDOWS_ERROR_DISK_FULL: i32 = 112; // ERROR_DISK_FULL
const UNIX_ENOSPC: i32 = 28;
const LINUX_EDQUOT: i32 = 122;
const MACOS_EDQUOT: i32 = 69;

pub fn storage_full_os_codes(os: &str) -> &'static [i32] {
    match os {
        "windows" => &[WINDOWS_ERROR_HANDLE_DISK_FULL, WINDOWS_ERROR_DISK_FULL],
        "linux" => &[UNIX_ENOSPC, LINUX_EDQUOT],
        "macos" => &[UNIX_ENOSPC, MACOS_EDQUOT],
        _ => &[UNIX_ENOSPC],
    }
}

pub fn user_facing_io_message(kind: ClassifiedIoKind) -> &'static str {
    match kind {
        ClassifiedIoKind::PermissionDenied => {
            "保存先に書き込みできませんでした。フォルダのアクセス権限をご確認ください。"
        }
        ClassifiedIoKind::NotFound => "対象ファイルが見つかりませんでした。",
        ClassifiedIoKind::AlreadyExists => "同名のファイルが既に存在します。",
        ClassifiedIoKind::WriteZero | ClassifiedIoKind::Generic => "ファイル操作に失敗しました。",
        ClassifiedIoKind::StorageFull => "ディスクの空き容量が不足しています。",
        ClassifiedIoKind::Busy => "少し時間を置いてもう一度お試しください。",
    }
}

pub fn format_operation_io_error(operation: &str, kind: ClassifiedIoKind) -> String {
    format!("{operation}。{}", user_facing_io_message(kind))
}

pub fn classify_std_io_error(error: &IoError) -> ClassifiedIoKind {
    match error.kind() {
        ErrorKind::PermissionDenied => ClassifiedIoKind::PermissionDenied,
        ErrorKind::NotFound => ClassifiedIoKind::NotFound,
        ErrorKind::AlreadyExists => ClassifiedIoKind::AlreadyExists,
        ErrorKind::WriteZero => ClassifiedIoKind::WriteZero,
        _ => {
            if is_storage_full_os_error(error) {
                ClassifiedIoKind::StorageFull
            } else {
                ClassifiedIoKind::Generic
            }
        }
    }
}

fn is_storage_full_os_error(error: &IoError) -> bool {
    error
        .raw_os_error()
        .is_some_and(|code| storage_full_os_codes(std::env::consts::OS).contains(&code))
}

pub fn classify_sqlite_error_code(code: ErrorCode) -> ClassifiedIoKind {
    match code {
        ErrorCode::DiskFull => ClassifiedIoKind::StorageFull,
        ErrorCode::DatabaseBusy | ErrorCode::DatabaseLocked => ClassifiedIoKind::Busy,
        ErrorCode::PermissionDenied | ErrorCode::ReadOnly => ClassifiedIoKind::PermissionDenied,
        ErrorCode::CannotOpen => ClassifiedIoKind::NotFound,
        ErrorCode::SystemIoFailure => ClassifiedIoKind::Generic,
        _ => ClassifiedIoKind::Generic,
    }
}

// 文字列は SQLite の言語非依存コード(SQLITE_FULL 等)に限って使う。
// 英語 OS メッセージ("Permission denied" 等)には依存しない。
pub fn classify_sqlite_message_fallback(text: &str) -> Option<ClassifiedIoKind> {
    if text.contains("SQLITE_FULL") {
        return Some(ClassifiedIoKind::StorageFull);
    }
    if text.contains("SQLITE_BUSY") || text.contains("SQLITE_LOCKED") {
        return Some(ClassifiedIoKind::Busy);
    }
    if text.contains("SQLITE_READONLY") || text.contains("SQLITE_PERM") {
        return Some(ClassifiedIoKind::PermissionDenied);
    }
    if text.contains("SQLITE_CANTOPEN") {
        return Some(ClassifiedIoKind::NotFound);
    }
    None
}

pub fn classify_rusqlite_error(error: &rusqlite::Error, dest: Option<&Path>) -> ClassifiedIoKind {
    let kind = match error {
        rusqlite::Error::SqliteFailure(ffi_error, message) => {
            let mut kind = classify_sqlite_error_code(ffi_error.code);
            if kind == ClassifiedIoKind::Generic {
                if let Some(text) = message.as_deref() {
                    if let Some(fallback) = classify_sqlite_message_fallback(text) {
                        kind = fallback;
                    }
                }
            }
            if kind == ClassifiedIoKind::Generic {
                if let Some(fallback) = classify_sqlite_message_fallback(&error.to_string()) {
                    kind = fallback;
                }
            }
            kind
        }
        rusqlite::Error::InvalidPath(_) => ClassifiedIoKind::NotFound,
        _ => classify_sqlite_message_fallback(&error.to_string())
            .unwrap_or(ClassifiedIoKind::Generic),
    };
    refine_open_failure(kind, dest)
}

fn refine_open_failure(kind: ClassifiedIoKind, dest: Option<&Path>) -> ClassifiedIoKind {
    if kind != ClassifiedIoKind::NotFound {
        return kind;
    }
    let Some(path) = dest else {
        return kind;
    };
    match path.parent() {
        Some(parent) if parent.exists() => ClassifiedIoKind::PermissionDenied,
        _ => ClassifiedIoKind::NotFound,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn error_kind_classification_does_not_depend_on_english_display() {
        assert_eq!(
            classify_std_io_error(&IoError::from(ErrorKind::PermissionDenied)),
            ClassifiedIoKind::PermissionDenied
        );
        assert_eq!(
            classify_std_io_error(&IoError::from(ErrorKind::NotFound)),
            ClassifiedIoKind::NotFound
        );
        assert_eq!(
            classify_std_io_error(&IoError::from(ErrorKind::AlreadyExists)),
            ClassifiedIoKind::AlreadyExists
        );
        assert_eq!(
            classify_std_io_error(&IoError::from(ErrorKind::WriteZero)),
            ClassifiedIoKind::WriteZero
        );
        assert_eq!(
            classify_std_io_error(&IoError::from(ErrorKind::Other)),
            ClassifiedIoKind::Generic
        );
    }

    #[test]
    fn user_messages_are_japanese_and_hide_engine_codes() {
        for kind in [
            ClassifiedIoKind::PermissionDenied,
            ClassifiedIoKind::NotFound,
            ClassifiedIoKind::AlreadyExists,
            ClassifiedIoKind::WriteZero,
            ClassifiedIoKind::StorageFull,
            ClassifiedIoKind::Busy,
            ClassifiedIoKind::Generic,
        ] {
            let message = user_facing_io_message(kind);
            assert!(!message.contains("SQLITE_"));
            assert!(!message.contains("Permission denied"));
            assert!(!message.contains("os error"));
            assert!(!message.contains("Access is denied"));
        }
        assert_eq!(
            user_facing_io_message(ClassifiedIoKind::PermissionDenied),
            "保存先に書き込みできませんでした。フォルダのアクセス権限をご確認ください。"
        );
        assert_eq!(
            user_facing_io_message(ClassifiedIoKind::StorageFull),
            "ディスクの空き容量が不足しています。"
        );
        assert_eq!(
            user_facing_io_message(ClassifiedIoKind::NotFound),
            "対象ファイルが見つかりませんでした。"
        );
        assert_eq!(
            user_facing_io_message(ClassifiedIoKind::Generic),
            "ファイル操作に失敗しました。"
        );
    }

    #[test]
    fn storage_full_codes_are_os_specific_and_centralized() {
        assert!(storage_full_os_codes("windows").contains(&WINDOWS_ERROR_DISK_FULL));
        assert!(storage_full_os_codes("windows").contains(&WINDOWS_ERROR_HANDLE_DISK_FULL));
        assert!(!storage_full_os_codes("linux").contains(&WINDOWS_ERROR_DISK_FULL));
        assert!(storage_full_os_codes("linux").contains(&UNIX_ENOSPC));
        assert!(storage_full_os_codes("linux").contains(&LINUX_EDQUOT));
        assert!(storage_full_os_codes("macos").contains(&MACOS_EDQUOT));
    }

    #[test]
    fn english_os_message_alone_is_not_classified_as_permission() {
        let error = IoError::other("Access is denied. (os error 5)");
        assert_eq!(classify_std_io_error(&error), ClassifiedIoKind::Generic);
        let error = IoError::other("There is not enough space on the disk");
        assert_eq!(classify_std_io_error(&error), ClassifiedIoKind::Generic);
    }

    #[cfg(unix)]
    #[test]
    fn unix_enospc_raw_code_is_storage_full() {
        let error = IoError::from_raw_os_error(UNIX_ENOSPC);
        assert_eq!(classify_std_io_error(&error), ClassifiedIoKind::StorageFull);
    }

    #[cfg(unix)]
    #[test]
    fn unix_does_not_treat_windows_disk_full_code_as_storage_full() {
        let error = IoError::from_raw_os_error(WINDOWS_ERROR_DISK_FULL);
        assert_eq!(classify_std_io_error(&error), ClassifiedIoKind::Generic);
    }

    #[cfg(windows)]
    #[test]
    fn windows_disk_full_raw_codes_are_storage_full() {
        let error = IoError::from_raw_os_error(WINDOWS_ERROR_DISK_FULL);
        assert_eq!(classify_std_io_error(&error), ClassifiedIoKind::StorageFull);
        let error = IoError::from_raw_os_error(WINDOWS_ERROR_HANDLE_DISK_FULL);
        assert_eq!(classify_std_io_error(&error), ClassifiedIoKind::StorageFull);
    }

    #[cfg(windows)]
    #[test]
    fn windows_access_denied_kind_is_permission_denied() {
        let error = IoError::from_raw_os_error(5);
        assert_eq!(
            classify_std_io_error(&error),
            ClassifiedIoKind::PermissionDenied
        );
    }

    #[test]
    fn sqlite_error_codes_are_classified_without_english_text() {
        assert_eq!(
            classify_sqlite_error_code(ErrorCode::DiskFull),
            ClassifiedIoKind::StorageFull
        );
        assert_eq!(
            classify_sqlite_error_code(ErrorCode::PermissionDenied),
            ClassifiedIoKind::PermissionDenied
        );
        assert_eq!(
            classify_sqlite_error_code(ErrorCode::ReadOnly),
            ClassifiedIoKind::PermissionDenied
        );
        assert_eq!(
            classify_sqlite_error_code(ErrorCode::DatabaseBusy),
            ClassifiedIoKind::Busy
        );
        assert_eq!(
            classify_sqlite_error_code(ErrorCode::CannotOpen),
            ClassifiedIoKind::NotFound
        );
        assert_eq!(
            classify_sqlite_error_code(ErrorCode::ConstraintViolation),
            ClassifiedIoKind::Generic
        );
        assert_eq!(
            classify_sqlite_error_code(ErrorCode::NotFound),
            ClassifiedIoKind::Generic
        );
    }

    #[test]
    fn sqlite_engine_code_fallback_ignores_localized_os_text() {
        assert_eq!(
            classify_sqlite_message_fallback("database or disk is full (SQLITE_FULL)"),
            Some(ClassifiedIoKind::StorageFull)
        );
        assert_eq!(
            classify_sqlite_message_fallback("Access is denied. (os error 5)"),
            None
        );
        assert_eq!(
            classify_sqlite_message_fallback("There is not enough space on the disk"),
            None
        );
    }

    #[test]
    fn cantopen_with_existing_parent_is_permission_denied() {
        let dir = std::env::temp_dir();
        let dest = dir.join("mitsumori-desk-io-error-test.db");
        let error = rusqlite::Error::SqliteFailure(
            rusqlite::ffi::Error::new(14), // SQLITE_CANTOPEN
            Some("unable to open database file".to_string()),
        );
        assert_eq!(
            classify_rusqlite_error(&error, Some(&dest)),
            ClassifiedIoKind::PermissionDenied
        );
        assert_eq!(
            classify_rusqlite_error(&error, None),
            ClassifiedIoKind::NotFound
        );
    }
}
