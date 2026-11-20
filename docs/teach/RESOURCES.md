# full-stack-mall 后端与部署教学资源

> 只收录教学调研中确认可信的来源。仓库事实与框架行为分开取证；一手来源优先，社区答案不能覆盖官方语义。

## 一、本仓库：代码与运行事实的一手来源

| 来源 | 用途 | 使用边界 |
| --- | --- | --- |
| `backend/src/main/java/com/fullstackmall/shop/` | 主教材：请求、鉴权、事务、支付、寄卖、秒杀等真实实现 | 代码事实必须落到具体文件与行号；行号漂移时重新读取 |
| `backend/pom.xml` | Java、Spring Boot、依赖、测试和打包方式 | 引入或升级依赖前另行验证，不从课程直接扩依赖 |
| `backend/src/main/resources/application.yml` | 本机默认端口、context path、数据库／Redis／RabbitMQ 与 Spring 占位配置 | 开发默认值不能视为生产安全配置 |
| 根目录 `docker-compose.yml` | 全栈容器、服务依赖、环境覆盖、健康检查、卷和唯一公开端口 | 与 `backend/docker-compose.yml` 的开发形态分开讲 |
| `backend/docker-compose.yml` | 本机开发基础设施与宿主机端口映射 | 应用本体在本机以 Maven 启动，不误称为容器 |
| `backend/Dockerfile` | 多阶段构建、非 root 运行和后端健康检查 | 镜像构建不跑测试，不代表测试门禁可省略 |
| `deploy/README.md` | 前后端独立部署拓扑、启动顺序和验证入口 | 真实服务器操作需明确授权 |
| `deploy/backend/README.md` | 后端独立部署、备份、恢复和容器重建后的 Nginx 联动 | 恢复只在一次性测试环境练习；MySQL 备份不含 Redis／MQ 全状态 |
| `deploy/frontend/README.md` | 前端镜像备份、回滚、Nginx upstream 与验证 | 回滚不能使用会按当前源码重建的命令 |
| `docs/superpowers/specs/`、`docs/superpowers/plans/` | 设计取舍、构建顺序与原始验收计划 | 计划是历史证据，不替代当前代码和实际执行结果 |
| `docs/teach/learning-records/` | 学习者的先验知识、已证明理解和误解修正 | 课程交付记录不等于掌握证据 |

## 二、官方文档：框架与工具行为

| 来源 | 用途 | 对应课程 |
| --- | --- | --- |
| [Spring Framework — Spring Web MVC](https://docs.spring.io/spring-framework/reference/web/webmvc.html) | DispatcherServlet、拦截器、异常处理和 MVC 请求语义 | 第 1、2 课 |
| [Spring Boot Reference](https://docs.spring.io/spring-boot/index.html) | 启动、配置、外部化配置和运行方式 | 第 1、8、9 课 |
| [MyBatis-Plus 官方文档](https://baomidou.com/) | Mapper、条件构造器、分页和映射 | 第 1、3、7 课 |
| [Docker Compose 官方文档](https://docs.docker.com/compose/) | 多容器应用、服务、网络与卷的总入口 | 第 9 课及部署专题 |
| [Compose — 控制启动顺序](https://docs.docker.com/compose/how-tos/startup-order/) | `depends_on` 与 `condition: service_healthy` 的准确语义 | 第 9 课主推荐来源 |
| [Compose — 变量插值](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/) | `${VAR:-default}`、`.env` 和 `docker compose config` | 第 9 课 |
| [Compose CLI — down](https://docs.docker.com/reference/cli/docker/compose/down/) | 默认删除容器与网络，`-v` 才删除 Compose 声明的命名卷 | 第 9 课、运维速查表 |
| [Docker — Volumes](https://docs.docker.com/engine/storage/volumes/) | 命名卷、挂载和持久化基础 | 部署与备份专题 |

Docker Compose 的启动依赖、变量插值和卷删除语义已于 2026-11-20 通过 Context7 检索 Docker 官方文档核验。

## 三、智慧：真实问题讨论社区

- [Stack Overflow — Spring Boot 标签](https://stackoverflow.com/questions/tagged/spring-boot)
  用于检索真实异常、版本差异和最小复现。先查官方文档，再比较回答版本与证据，不复制没有上下文的“可用答案”。
- [Stack Overflow — Docker Compose 标签](https://stackoverflow.com/questions/tagged/docker-compose)
  用于比较真实 Compose 故障的症状和诊断过程。涉及数据删除、密钥或网络暴露的建议必须回到官方文档复核。

## 四、当前资源空白

以下主题在创建对应课程前必须补充并核验一手资料：

- Linux 服务器基线、防火墙、HTTPS 与域名证书；
- 异地备份、恢复演练和恢复点／恢复时间目标；
- 日志、指标、告警和上线后的持续观察；
- 真实支付渠道的签名、回调和对账规范。

## 五、使用规则

1. **仓库事实看代码，框架语义看官方文档，掌握程度看学习者实验。**
2. 不把旧课程中的行号当永久事实；代码变化后重新读取并更新受影响课程。
3. 不把 AI 生成的预期、测试或命令输出伪装成真实世界证据。
4. 资源被证明过时、错误或偏离任务时直接修剪，不保留“以后也许有用”的链接堆积。
5. 若学习者明确不愿参与社区，记录偏好，后续课程不重复推荐。
