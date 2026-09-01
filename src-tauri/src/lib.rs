mod commands;
mod io_errors;

use tauri_plugin_sql::{Migration, MigrationKind};

// sqlxはforeign_keysプラグマを既定でONにするため、接続文字列での指定は不要。
const DB_URL: &str = "sqlite:mitsumori-desk.db?mode=rwc";

pub(crate) fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "initial",
            sql: include_str!("../migrations/0001_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "ai_settings_and_extractions",
            sql: include_str!("../migrations/0002_ai_settings_and_extractions.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "practice_data_and_onboarding_step",
            sql: include_str!("../migrations/0003_practice_data_and_onboarding_step.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "feature_flags",
            sql: include_str!("../migrations/0004_feature_flags.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

pub(crate) fn current_schema_version() -> i64 {
    migrations()
        .into_iter()
        .map(|migration| migration.version)
        .max()
        .unwrap_or(0)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DB_URL, migrations())
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            commands::secrets::secret_get,
            commands::secrets::secret_set,
            commands::secrets::secret_delete,
            commands::backup::backup_database,
            commands::backup::list_backups,
            commands::safe_restore::restore_database,
            commands::backup::export_backup_to,
            commands::backup::import_backup_from,
            commands::diagnostics::get_system_diagnostics,
            commands::diagnostics::write_text_file,
            commands::transaction::execute_transaction,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrations_are_numbered_sequentially_from_one() {
        let list = migrations();
        assert!(!list.is_empty());
        for (index, migration) in list.iter().enumerate() {
            assert_eq!(migration.version, (index + 1) as i64);
        }
    }

    #[test]
    fn current_schema_version_matches_latest_registered_migration() {
        let list = migrations();
        let latest = list.last().expect("at least one migration").version;
        assert_eq!(current_schema_version(), latest);
        assert_eq!(latest, list.len() as i64);
        assert!(current_schema_version() > 0);
    }

    #[test]
    fn initial_migration_creates_core_tables() {
        let sql = &migrations()[0].sql;
        for table in [
            "companies",
            "clients",
            "catalog_items",
            "catalog_aliases",
            "documents",
            "document_lines",
            "document_events",
            "app_settings",
        ] {
            assert!(
                sql.contains(&format!("CREATE TABLE {table}")),
                "migration is missing table: {table}"
            );
        }
    }

    #[test]
    fn second_migration_adds_ai_extractions_table() {
        let sql = &migrations()[1].sql;
        assert!(sql.contains("CREATE TABLE ai_extractions"));
        assert!(sql.contains("ALTER TABLE app_settings ADD COLUMN ai_model"));
    }

    #[test]
    fn third_migration_adds_practice_data_flags_and_onboarding_step() {
        let sql = &migrations()[2].sql;
        assert!(sql.contains("ALTER TABLE app_settings ADD COLUMN onboarding_step"));
        for table in ["companies", "clients", "catalog_items", "documents"] {
            assert!(
                sql.contains(&format!("ALTER TABLE {table} ADD COLUMN is_practice_data")),
                "migration is missing is_practice_data column on: {table}"
            );
        }
    }

    #[test]
    fn fourth_migration_adds_feature_flags_column() {
        let sql = &migrations()[3].sql;
        assert!(sql.contains("ALTER TABLE app_settings ADD COLUMN feature_flags_json"));
    }
}
