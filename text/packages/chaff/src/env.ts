import { existsSync } from "node:fs";
import { join } from "node:path";

export const ENV_FILE = ".env";

/**
 * 作業ディレクトリの .env を読む。依存は足さない（Node が持っている）。
 *
 * **すでに設定されている環境変数は上書きしない。** シェルで渡したほうが勝つ。
 * 逆にすると、一時的に別の key で試したいときに .env が黙って勝ってしまう。
 *
 * 読んだかどうかを返すのは、鍵がどこから来たのかを人に見せるため。
 * 「設定したのに効かない」を、鍵の置き場所で起こさせない。
 */
export const loadEnvFile = (dir: string): string | undefined => {
  const path = join(dir, ENV_FILE);
  if (!existsSync(path)) return undefined;
  process.loadEnvFile(path);
  return path;
};
