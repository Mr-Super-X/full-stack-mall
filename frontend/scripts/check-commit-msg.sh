#!/usr/bin/env sh
# commit message 违禁词检查：AI 协作痕迹拦截（owner 规定 2026-10-30，CLAUDE.md §4 #16）
# 由 .husky/commit-msg 调用；可独立执行/测试：sh scripts/check-commit-msg.sh <msg-file>
# 拦截口径（宽拦）：
#   ① Co-Authored-By trailer 全拦——单人项目，真人协作属例外，走 git commit --no-verify
#   ② 裸词结构化特征（Generated with <AI> / <AI> 共创 / anthropic），覆盖国外+国产 AI 工具的非 trailer 标注
#     词表只拦"工具名出现在生成/共创标注语境"，单独提及工具名（如"升级 deepseek 依赖"）不误伤
MSG_FILE="$1"
if [ -z "$MSG_FILE" ]; then
  echo "用法: check-commit-msg.sh <commit-msg-file>" >&2
  exit 2
fi

if grep -qiE 'co-authored-by:|(generated|written|created|authored).{0,20}with.{0,20}(claude|codex|copilot|gemini|genai|openai|devin|windsurf|codeium|cursor|aider|kimi|moonshot|qwen|deepseek|doubao|glm|chatglm|ernie|wenxin|yiyan|spark|hunyuan|baichuan|minimax|sensenova|01\.ai|trae|codearts|iflycode|codebuddy|fitten|lingma)|共创|anthropic' "$MSG_FILE"; then
  echo "❌ commit message 禁止包含 AI 协作痕迹（Co-Authored-By trailer / Generated with <AI> / <AI> 共创 等，含国产工具），见 CLAUDE.md §4 #16；真人协作例外请用 git commit --no-verify" >&2
  exit 1
fi

exit 0
