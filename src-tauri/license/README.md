# ライセンス公開鍵

`public_key.b64` は、アプリに埋め込むライセンス検証用の **公開鍵**(Ed25519, 32byte の base64)です。

- 現在の値は **開発用の鍵**(`scripts/license/license-format.mjs` の `DEV_KEY_SEED_TEXT` から誰でも作れる)です。販売には使えません。
- 販売前に販売者が `pnpm license:keygen` で本番鍵を作り、表示された公開鍵でこのファイルを置き換えます(`docs/MANUAL_STEPS.md`)。
- 秘密鍵は絶対にこのリポジトリへ置かないでください。`pnpm check:release -- --strict` は開発用の鍵のままだと失敗します。
