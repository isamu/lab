// The playground's sample texts: written for this page, each with a few mistakes chaff finds, and the genre it is read
// as. test/test_playground_samples.ts checks that each still gets findings.

export type PlaygroundSample = { readonly id: string; readonly genre: string; readonly name: string; readonly text: string };

const ja: readonly PlaygroundSample[] = [
  {
    id: "blog",
    genre: "blog/tech",
    name: "技術ブログ",
    text: `# キャッシュで API の応答を速くする

この記事では、Redis を使ったキャッシュの入れ方を説明します。とても非常に効果的な方法です。

まず、キャッシュの有効期限を決めます。次に、読み出しの処理を書き換えます。最後に、書き込みの処理を書き換えます。

設定は2026年10月6日（月）に本番へ反映しました。いかがでしたか？
`,
  },
  {
    id: "email",
    genre: "business/email",
    name: "メール",
    text: `件名: 見積書の送付について

株式会社サンプル
山田様

いつもお世話になっております。

ご依頼いただいた見積書を添付いたします。ご確認のほど、よろしくお願い申し上げます。
なお、ご不明な点がございましたら、お気軽にお問い合わせください。
お手数ですが、来週中にご返信いただけますと幸いです。

よろしくお願いいたします。
`,
  },
  {
    id: "contract",
    genre: "legal/contract",
    name: "契約書の条項",
    text: `株式会社みなと商会（以下「甲」という。）と株式会社しおさい技研（以下「乙」という。）は、次のとおり業務委託契約を結ぶ。

第1条（目的）
甲は、ウェブサイトの保守の業務（以下「本業務」という。）を乙に委託し、受託者はこれを受託する。

第2条（委託料）
本業務の委託料の内訳は、保守費60,000円、運用費30,000円とし、合計100,000円とする。甲は、毎月末日までに委託料を支払う。

第4条（報告）
乙は、毎月5日までに本件業務の状況を甲に報告する。甲は、報告を受けた日から10日以内に結果を通知する。乙は、甲の求めがあれば速やかに資料を出す。ただし、第8条に定める場合を除く。

第5条（期間）
本契約の期間は、2026年4月1日（火）から2027年3月31日までとする。
`,
  },
  {
    id: "press",
    genre: "business/press-release",
    name: "プレスリリース",
    text: `# 新製品「サンプル Pro」発売のお知らせ

株式会社サンプル（本社: 東京都千代田区）は、業界最高の性能を持つ新製品「サンプル Pro」を2026年11月1日（月）に発売します。

「サンプル Pro」は、従来の製品と比べて処理速度が大幅に向上しました。画期的な新機能を多数搭載し、お客様の業務を革新的に変える、非常に重要な一歩です。

価格はオープン価格です。
`,
  },
];

const en: readonly PlaygroundSample[] = [
  {
    id: "blog",
    genre: "blog/tech",
    name: "Tech blog",
    text: `# Make your API faster with a cache

In this post we we add a cache in front of the API , and it was deployed on Monday, October 6, 2026.

The change was reviewed carefully and it was decided that the old endpoint will be kept for now because the clients that were written last year still call it on every request that they make to the service.

I hope this helps!
`,
  },
  {
    id: "email",
    genre: "business/email",
    name: "Email",
    text: `Subject: Quote for the website project

Hi Dana,

I hope this email finds you well. As per our call, please find attached the quote for the the website project.

Please let me know if you have any questions. Please reply by Friday, October 9, 2025.

Best regards,
Sam
`,
  },
  {
    id: "contract",
    genre: "legal/contract",
    name: "Contract clause",
    text: `This agreement is made between Harbour Works Ltd (the "Supplier") and Northwind Retail Inc. (the "Customer").

Section 1 (Services)
The Supplier shall provide the hosting and support services (the "Services") to the Customer.

Section 2 (Fees)
The monthly fee consists of $6,000 for hosting and $2,000 for support, for a total of $9,000. The Customer shall pay each invoice within thirty days of receiving it.

Section 4 (Reports)
The Supplier shall deliver a report by the fifth business day of each month. The Vendor shall fix any defect promptly, except as set out in Section 8.

Section 5 (Term)
This Agreement runs from Wednesday, April 1, 2026 to Tuesday, March 31, 2026.
`,
  },
  {
    id: "press",
    genre: "business/press-release",
    name: "Press release",
    text: `# Sample Inc. launches Sample Pro

Sample Inc. today announced Sample Pro, the most unique tool in the industry, available on Monday, November 1, 2026.

Sample Pro is a revolutionary, game-changing product that dramatically improves speed. It leverages cutting-edge technology to empower teams.
`,
  },
];

export const PLAYGROUND_SAMPLES: Readonly<Record<"ja" | "en", readonly PlaygroundSample[]>> = { ja, en };
