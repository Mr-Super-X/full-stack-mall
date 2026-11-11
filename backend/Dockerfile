# syntax=docker/dockerfile:1
# 生产镜像（多阶段）：maven 构建可执行 JAR → jre-alpine 运行。
# 构建期不跑测试（209 用例由本地 mvn verify 承担，镜像构建跑测试 10min+ 无收益——spec §6.1 取舍）；
# 可复现性由 pom 锁定版本 + base image tag 锁定保障。
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn -q -DskipTests package

FROM eclipse-temurin:17-jre-alpine
RUN addgroup -S mall && adduser -S mall -G mall
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
USER mall
EXPOSE 18080
# 健康检查：/api/mall/product/list 匿名可访问（WebMvcConfig 拦截名单不含它）；
# alpine 无 curl，用 busybox wget
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=5 \
  CMD wget -qO- http://127.0.0.1:18080/api/mall/product/list > /dev/null 2>&1 || exit 1
ENTRYPOINT ["java", "-jar", "app.jar"]
