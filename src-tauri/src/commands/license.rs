// オフラインのライセンスキー検証(ADR 0009)。
//
// 形式: MDK1.<base64url(payload JSON)>.<base64url(Ed25519署名)>
// 署名対象は "MDK1." + payload部分 のバイト列。販売者用スクリプト
// (scripts/license/license-format.mjs)と同じ規則。
//
// この検証結果は「表示」と「印刷物の透かし」にだけ使う。ライセンスが無い・壊れている
// ことを理由に、帳票データの閲覧・編集・発行・バックアップを止めてはいけない(ADR 0008/0009)。
use base64::engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD};
use base64::Engine;
use ed25519_dalek::{Signature, VerifyingKey};
use serde::{Deserialize, Serialize};

const LICENSE_PREFIX: &str = "MDK1";
const PRODUCT_ID: &str = "mitsumori-desk";
const PUBLIC_KEY_BASE64: &str = include_str!("../../license/public_key.b64");
// キーの長さの上限(貼り付け事故で巨大な文字列が来ても処理しない)
const MAX_KEY_LENGTH: usize = 1024;

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(tag = "state", rename_all = "snake_case")]
pub enum LicenseVerification {
    Valid {
        #[serde(rename = "licenseId")]
        license_id: String,
        #[serde(rename = "issuedAt")]
        issued_at: String,
    },
    Invalid {
        reason: InvalidReason,
    },
}

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum InvalidReason {
    Malformed,
    BadSignature,
    UnsupportedVersion,
    WrongProduct,
}

#[derive(Deserialize)]
struct Payload {
    v: u32,
    prod: String,
    lid: String,
    iat: String,
}

fn invalid(reason: InvalidReason) -> LicenseVerification {
    LicenseVerification::Invalid { reason }
}

/// 貼り付け時に混ざる改行・空白(全角スペースを含む)を取り除く。
pub fn normalize_key(raw: &str) -> String {
    raw.chars()
        .filter(|c| !c.is_whitespace() && *c != '\u{3000}')
        .collect()
}

pub fn verify_license_with_key(public_key: &VerifyingKey, raw: &str) -> LicenseVerification {
    if raw.len() > MAX_KEY_LENGTH * 4 {
        return invalid(InvalidReason::Malformed);
    }
    let key = normalize_key(raw);
    if key.len() > MAX_KEY_LENGTH {
        return invalid(InvalidReason::Malformed);
    }
    let parts: Vec<&str> = key.split('.').collect();
    if parts.len() != 3 || parts[0] != LICENSE_PREFIX {
        return invalid(InvalidReason::Malformed);
    }
    let Ok(signature_bytes) = URL_SAFE_NO_PAD.decode(parts[2]) else {
        return invalid(InvalidReason::Malformed);
    };
    let Ok(signature_array) = <[u8; 64]>::try_from(signature_bytes.as_slice()) else {
        return invalid(InvalidReason::Malformed);
    };
    let signature = Signature::from_bytes(&signature_array);
    let signing_input = format!("{}.{}", parts[0], parts[1]);
    if public_key
        .verify_strict(signing_input.as_bytes(), &signature)
        .is_err()
    {
        return invalid(InvalidReason::BadSignature);
    }
    // 署名が正しい場合だけ中身を読む
    let Ok(payload_bytes) = URL_SAFE_NO_PAD.decode(parts[1]) else {
        return invalid(InvalidReason::Malformed);
    };
    let Ok(payload) = serde_json::from_slice::<Payload>(&payload_bytes) else {
        return invalid(InvalidReason::Malformed);
    };
    if payload.v != 1 {
        return invalid(InvalidReason::UnsupportedVersion);
    }
    if payload.prod != PRODUCT_ID {
        return invalid(InvalidReason::WrongProduct);
    }
    LicenseVerification::Valid {
        license_id: payload.lid,
        issued_at: payload.iat,
    }
}

fn embedded_public_key() -> Result<VerifyingKey, String> {
    let bytes = STANDARD
        .decode(PUBLIC_KEY_BASE64.trim())
        .map_err(|_| "ライセンス検証用の公開鍵が壊れています".to_string())?;
    let array = <[u8; 32]>::try_from(bytes.as_slice())
        .map_err(|_| "ライセンス検証用の公開鍵が壊れています".to_string())?;
    VerifyingKey::from_bytes(&array)
        .map_err(|_| "ライセンス検証用の公開鍵が壊れています".to_string())
}

#[tauri::command]
pub fn verify_license_key(key: String) -> Result<LicenseVerification, String> {
    let public_key = embedded_public_key()?;
    Ok(verify_license_with_key(&public_key, &key))
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};

    // scripts/license/license-format.mjs の開発用鍵(DEV_KEY_SEED_TEXT)で Node が発行したキー。
    // Node(販売者スクリプト)と Rust(アプリ)の形式が一致していることを固定する。
    const NODE_DEV_KEY: &str = "MDK1.eyJ2IjoxLCJwcm9kIjoibWl0c3Vtb3JpLWRlc2siLCJsaWQiOiJERVYtMDAwMSIsImlhdCI6IjIwMjYtMTAtMDEifQ.p3uveMCXyGwoPoeLg-c9DKVPPE52_HVi8UaYVcVGyFRugh2or9_qMd-_JYC04oFLZpWLe6FL7ozoj8o7Pvj5Ag";
    const DEV_PUBLIC_KEY: &str = "UkuycHVt2uTtVWksgTohS3iLI1gnBHX/mV3pqqLGCy8=";

    fn dev_public_key() -> VerifyingKey {
        let bytes = STANDARD.decode(DEV_PUBLIC_KEY).unwrap();
        VerifyingKey::from_bytes(&<[u8; 32]>::try_from(bytes.as_slice()).unwrap()).unwrap()
    }

    fn sign_payload(signing_key: &SigningKey, payload_json: &str) -> String {
        let payload = URL_SAFE_NO_PAD.encode(payload_json.as_bytes());
        let input = format!("MDK1.{payload}");
        let signature = signing_key.sign(input.as_bytes());
        format!("{input}.{}", URL_SAFE_NO_PAD.encode(signature.to_bytes()))
    }

    #[test]
    fn accepts_key_issued_by_node_seller_script() {
        let result = verify_license_with_key(&dev_public_key(), NODE_DEV_KEY);
        assert_eq!(
            result,
            LicenseVerification::Valid {
                license_id: "DEV-0001".into(),
                issued_at: "2026-10-01".into()
            }
        );
    }

    #[test]
    fn accepts_key_with_line_breaks_and_full_width_spaces() {
        let wrapped = format!("{}\n\u{3000}{} ", &NODE_DEV_KEY[..30], &NODE_DEV_KEY[30..]);
        assert!(matches!(
            verify_license_with_key(&dev_public_key(), &wrapped),
            LicenseVerification::Valid { .. }
        ));
    }

    #[test]
    fn rejects_tampered_payload() {
        let parts: Vec<&str> = NODE_DEV_KEY.split('.').collect();
        let forged_payload = URL_SAFE_NO_PAD
            .encode(br#"{"v":1,"prod":"mitsumori-desk","lid":"FREE","iat":"2026-10-01"}"#);
        let forged = format!("{}.{}.{}", parts[0], forged_payload, parts[2]);
        assert_eq!(
            verify_license_with_key(&dev_public_key(), &forged),
            invalid(InvalidReason::BadSignature)
        );
    }

    #[test]
    fn rejects_key_signed_by_another_key() {
        let other = SigningKey::from_bytes(&[7u8; 32]);
        let key = sign_payload(
            &other,
            r#"{"v":1,"prod":"mitsumori-desk","lid":"X","iat":"2026-10-01"}"#,
        );
        assert_eq!(
            verify_license_with_key(&dev_public_key(), &key),
            invalid(InvalidReason::BadSignature)
        );
    }

    #[test]
    fn rejects_malformed_input() {
        let key = dev_public_key();
        for raw in [
            "",
            "abc",
            "MDK1.x",
            "MDK2.a.b",
            "MDK1.a.b.c",
            "MDK1.eyJ.!!!",
        ] {
            assert_eq!(
                verify_license_with_key(&key, raw),
                invalid(InvalidReason::Malformed),
                "{raw}"
            );
        }
        let huge = "A".repeat(10_000);
        assert_eq!(
            verify_license_with_key(&key, &huge),
            invalid(InvalidReason::Malformed)
        );
    }

    #[test]
    fn rejects_other_product_and_unknown_version() {
        let signing_key = SigningKey::from_bytes(&[9u8; 32]);
        let public_key = signing_key.verifying_key();
        let other_product = sign_payload(
            &signing_key,
            r#"{"v":1,"prod":"other-app","lid":"X","iat":"2026-10-01"}"#,
        );
        assert_eq!(
            verify_license_with_key(&public_key, &other_product),
            invalid(InvalidReason::WrongProduct)
        );
        let future = sign_payload(
            &signing_key,
            r#"{"v":2,"prod":"mitsumori-desk","lid":"X","iat":"2026-10-01"}"#,
        );
        assert_eq!(
            verify_license_with_key(&public_key, &future),
            invalid(InvalidReason::UnsupportedVersion)
        );
    }

    #[test]
    fn embedded_public_key_is_well_formed() {
        assert!(embedded_public_key().is_ok());
    }

    #[test]
    fn serializes_to_frontend_shape() {
        let valid = serde_json::to_value(LicenseVerification::Valid {
            license_id: "L-1".into(),
            issued_at: "2026-10-01".into(),
        })
        .unwrap();
        assert_eq!(
            valid,
            serde_json::json!({"state":"valid","licenseId":"L-1","issuedAt":"2026-10-01"})
        );
        let bad = serde_json::to_value(invalid(InvalidReason::BadSignature)).unwrap();
        assert_eq!(
            bad,
            serde_json::json!({"state":"invalid","reason":"bad_signature"})
        );
    }
}
