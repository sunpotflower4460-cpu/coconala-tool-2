import type { CatalogItemForExtraction } from "@/application/ports/ai-provider";

export const INQUIRY_EXTRACTION_SYSTEM_PROMPT = `あなたは日本の小規模事業者向け見積作成ツールの補助を行います。
利用者が貼り付けた問い合わせ文を読み取り、見積の下書きに使える構造化データへ整理してください。

厳守事項:
- 金額(円)を一切出力しないでください。あなたは価格表IDと数量だけを提案します。金額は価格表から計算します。
- catalog_item_idは、必ず利用者から渡された価格表一覧のIDの中からのみ選んでください。一覧にないIDを作らないでください。
- 数量や納期が文章から読み取れない場合は、無理に推測せずnullにし、questionsへ確認事項を書いてください。
- 出力は指定されたJSON形式のみとし、それ以外の文章を含めないでください。`;

export function buildInquiryExtractionUserPrompt(
  text: string,
  catalogItems: CatalogItemForExtraction[],
): string {
  const catalogList = catalogItems
    .map((item) => {
      const aliasText = item.aliases.length > 0 ? `(別名: ${item.aliases.join("、")})` : "";
      return `- id=${item.id}: ${item.name}${aliasText} 単位=${item.unit ?? "未設定"}`;
    })
    .join("\n");

  return `# 価格表一覧
${catalogList || "(価格表が登録されていません)"}

# 問い合わせ文
${text}

# 出力するJSON形式
{
  "summary": "依頼の短い要約",
  "requested_due_date": "YYYY-MM-DD、読み取れなければnull",
  "items": [
    {
      "source_text": "元の文章のうち該当する部分",
      "normalized_name": "整理した品目名",
      "quantity": 3,
      "unit": "本",
      "catalog_candidates": [
        { "catalog_item_id": 1, "confidence": 0.9, "reason": "一致理由" }
      ],
      "questions": ["利用者に確認したいこと"]
    }
  ],
  "global_questions": ["全体として確認したいこと"]
}`;
}
