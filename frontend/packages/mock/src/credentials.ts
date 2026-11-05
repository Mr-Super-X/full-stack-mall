/**
 * mock 演示账号常量单源（/autoplan E12）。
 *
 * 背景：dev 形态（auth.ts rawResponse）与 prod 形态（mockProdServer.ts 内联 response）
 * 各存一份 `admin/123456` 字面量，改口令需人肉同步两处——与全仓单源治理精神相悖。
 * 本模块是唯一定义处，两形态 import 消费。
 *
 * 安全注记：演示用途的公开口令（gh-pages demo 亦用），非真实凭证——但任一口令变更
 * 仍应单点修改，避免 dev 可登录/prod 不可登录的行为分叉。
 */
export const MOCK_USERNAME = 'admin'
export const MOCK_PASSWORD = '123456'
