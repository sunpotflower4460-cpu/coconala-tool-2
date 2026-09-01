use rusqlite::types::Value as SqlValue;
use rusqlite::{params_from_iter, Connection};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use tauri::AppHandle;

use super::backup::db_path;

#[derive(Deserialize)]
pub struct TransactionStatement {
    pub sql: String,
    pub params: Vec<JsonValue>,
}

#[derive(Serialize, Clone, Copy)]
pub struct TransactionStatementResult {
    pub rows_affected: usize,
    pub last_insert_id: i64,
}

// 通常の値に加え、`{"$ref": <直前までのSQL実行結果のインデックス>}` という形の
// オブジェクトを、その回のINSERTで採番されたIDへ置き換える。
// 新規作成した書類のidを、後続の明細INSERTのdocument_idとして使う場合などに用いる。
fn json_to_sql_value(
    value: &JsonValue,
    previous_results: &[TransactionStatementResult],
) -> Result<SqlValue, String> {
    match value {
        JsonValue::Null => Ok(SqlValue::Null),
        JsonValue::Bool(value) => Ok(SqlValue::Integer(i64::from(*value))),
        JsonValue::Number(number) => {
            if let Some(value) = number.as_i64() {
                Ok(SqlValue::Integer(value))
            } else if let Some(value) = number.as_f64() {
                Ok(SqlValue::Real(value))
            } else {
                Err("数値をSQLパラメータへ変換できませんでした".to_string())
            }
        }
        JsonValue::String(value) => Ok(SqlValue::Text(value.clone())),
        JsonValue::Object(map) => {
            let index = map
                .get("$ref")
                .and_then(JsonValue::as_u64)
                .ok_or("オブジェクト型のパラメータは$ref参照のみ使用できます".to_string())?
                as usize;
            let referenced = previous_results
                .get(index)
                .ok_or_else(|| format!("参照先のSQL実行結果が見つかりません(index={index})"))?;
            Ok(SqlValue::Integer(referenced.last_insert_id))
        }
        JsonValue::Array(_) => Err("配列はSQLパラメータとして使用できません".to_string()),
    }
}

// tauri-plugin-sqlはSQLite接続をプールしており、JS側から個別に送るBEGIN/COMMITは
// 別の接続に振り分けられる可能性があるため、複数文にまたがる本当のトランザクションを保証できない
// (実際に "cannot commit - no transaction is active" が発生することを実機確認済み)。
// そのため、真の原子性が必要な複数文の書き込みは、専用のrusqlite接続を1本開いてこのコマンドで実行する。
#[tauri::command]
pub fn execute_transaction(
    app: AppHandle,
    statements: Vec<TransactionStatement>,
) -> Result<Vec<TransactionStatementResult>, String> {
    let path = db_path(&app)?;
    let mut conn = Connection::open(&path)
        .map_err(|error| format!("データベースを開けませんでした: {error}"))?;
    // tauri-plugin-sql側の接続と同じファイルへ同時にアクセスするため、ロック競合時は待機する。
    conn.busy_timeout(std::time::Duration::from_secs(5))
        .map_err(|error| format!("データベース設定に失敗しました: {error}"))?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|error| format!("データベース設定に失敗しました: {error}"))?;
    let tx = conn
        .transaction()
        .map_err(|error| format!("トランザクションを開始できませんでした: {error}"))?;

    let mut results: Vec<TransactionStatementResult> = Vec::with_capacity(statements.len());
    for statement in &statements {
        let sql_params = statement
            .params
            .iter()
            .map(|value| json_to_sql_value(value, &results))
            .collect::<Result<Vec<_>, String>>()?;
        let rows_affected = tx
            .execute(&statement.sql, params_from_iter(sql_params))
            .map_err(|error| format!("SQL実行に失敗しました: {error}"))?;
        results.push(TransactionStatementResult {
            rows_affected,
            last_insert_id: tx.last_insert_rowid(),
        });
    }

    tx.commit()
        .map_err(|error| format!("コミットに失敗しました: {error}"))?;

    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::{json_to_sql_value, TransactionStatementResult};
    use rusqlite::types::Value as SqlValue;
    use serde_json::json;

    fn previous(last_insert_id: i64) -> Vec<TransactionStatementResult> {
        vec![TransactionStatementResult {
            rows_affected: 1,
            last_insert_id,
        }]
    }

    #[test]
    fn json_null_bool_string_and_integer_convert() {
        let previous_results = previous(42);
        assert!(matches!(
            json_to_sql_value(&json!(null), &previous_results).unwrap(),
            SqlValue::Null
        ));
        assert_eq!(
            json_to_sql_value(&json!(true), &previous_results).unwrap(),
            SqlValue::Integer(1)
        );
        assert_eq!(
            json_to_sql_value(&json!("顧客'; DROP TABLE clients;--"), &previous_results).unwrap(),
            SqlValue::Text("顧客'; DROP TABLE clients;--".to_string())
        );
        assert_eq!(
            json_to_sql_value(&json!(7), &previous_results).unwrap(),
            SqlValue::Integer(7)
        );
    }

    #[test]
    fn json_array_params_are_rejected() {
        let error = json_to_sql_value(&json!([1, 2]), &[]).unwrap_err();
        assert!(error.contains("配列はSQLパラメータとして使用できません"));
    }

    #[test]
    fn json_object_without_ref_is_rejected() {
        let error = json_to_sql_value(&json!({"evil": 1}), &[]).unwrap_err();
        assert!(error.contains("$ref"));
    }

    #[test]
    fn json_ref_resolves_to_previous_insert_id() {
        let value = json_to_sql_value(&json!({ "$ref": 0 }), &previous(99)).unwrap();
        assert_eq!(value, SqlValue::Integer(99));
    }

    #[test]
    fn json_ref_out_of_range_is_rejected() {
        let error = json_to_sql_value(&json!({ "$ref": 3 }), &previous(1)).unwrap_err();
        assert!(error.contains("参照先のSQL実行結果が見つかりません"));
    }
}
