import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hasNewCodeOrLink, isLinkList } from "../packages/chaff/src/closing-code.ts";

// empty-conclusion sends a closing to the judge unless it gives something concrete; code or a link the body already gave is not.

describe("hasNewCodeOrLink", () => {
  const body =
    "次のコマンドで作ります。\n\n```bash\npython -m venv .venv\npip freeze > requirements.txt\n```\n\n詳しくは https://docs.python.org/3/library/venv.html を見てください。\n";

  const repeated: readonly (readonly [string, string])[] = [
    ["- `python -m venv .venv` で作成する\n- `pip freeze > requirements.txt` で記録する", "commands the body gave"],
    ["詳しくは https://docs.python.org/3/library/venv.html へ。", "a link the body gave"],
    ["[公式の説明](https://docs.python.org/3/library/venv.html)を読んでください。", "the same link, linked"],
    ["以上のとおりです。", "no code and no link"],
    ["", "an empty closing"],
  ];
  repeated.forEach(([closing, label]) => {
    it(`reads ${label} as nothing new`, () => assert.equal(hasNewCodeOrLink(closing, body), false));
  });

  const fresh: readonly (readonly [string, string])[] = [
    ["次は `pip install -r requirements.txt` で戻せます。", "a command the body did not give"],
    ["続きは https://example.com/next に書きました。", "a new link"],
    ["```bash\npython -m venv .venv\n```", "a fenced block, even of the body's code"],
    ["~~~\nexit\n~~~", "a tilde fence"],
  ];
  fresh.forEach(([closing, label]) => {
    it(`reads ${label} as new`, () => assert.equal(hasNewCodeOrLink(closing, body), true));
  });

  it("reads any code or link as new when nothing came before", () => {
    assert.equal(hasNewCodeOrLink("`chaff lint` を回してください。", ""), true);
    assert.equal(hasNewCodeOrLink("https://example.com", ""), true);
  });

  it("does not take an unclosed backtick or a bare word for code", () => {
    assert.equal(hasNewCodeOrLink("` だけの行です。", body), false);
    assert.equal(hasNewCodeOrLink("http だけ書きました。", body), false);
  });
});

describe("isLinkList", () => {
  it("reads a references section of linked items", () => {
    assert.equal(isLinkList("## 参考文献\n\n* [Gitの内側](https://example.com/git)\n* https://example.com/index\n"), true);
    assert.equal(isLinkList("## Further reading\n\n1. [Pro Git](https://example.com/progit)\n"), true);
  });

  it("does not read a closing with prose, an item without a link, or nothing at all", () => {
    assert.equal(isLinkList("## まとめ\n\n* [Gitの内側](https://example.com/git)\n\n以上です。\n"), false);
    assert.equal(isLinkList("## まとめ\n\n* [Gitの内側](https://example.com/git)\n* 索引の話\n"), false);
    assert.equal(isLinkList("## まとめ\n"), false);
    assert.equal(isLinkList(""), false);
  });
});
