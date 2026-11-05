/**
 * XForm schema 链式构建器 —— 兼容 barrel
 *
 * 架构审查 #3 拆分：实现已迁到 builders/ 子目录（core / fields-input /
 * fields-select / fields-date / fields-data / containers），本文件仅做转发。
 *
 * ⚠️ 保留本文件的原因：全部消费方（demo / docs / specs / 业务）以
 * `@/components/form-schema/builders` 路径导入 —— Vite 与 TS 在
 * `builders.ts` 与 `builders/` 目录并存时优先解析文件，故本 barrel
 * 让旧路径继续可用，27 个 xXxx 入口 + NodeBuilder + ArrayBuilder 导出面不变。
 *
 * 按 component 名字母 A-Z 分组，每个 component 包含「makeBuilder 工厂 + Ext 子类 + xXxx 入口」三件套，
 * 查找 builder 能力从跨 2-3 处跳转 → 同 1 节内查找。
 *
 * ```ts
 * const schema = {
 *   column: 2,
 *   row: { gutter: 24 },
 *   children: [
 *     xInput('email')
 *       .label('邮箱')
 *       .required()
 *       .placeholder('a@b.com')
 *       .defaultValue('a@b.com')
 *       .build(),
 *     //       ↑ 全部有类型推导
 *   ],
 * }
 * ```
 *
 * @group XForm 构建器
 */
export * from './builders/index'
