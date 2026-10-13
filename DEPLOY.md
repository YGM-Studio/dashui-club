# 大水肌薄社区部署交接

本项目可以部署到阿里云或腾讯云的一台 Linux 云服务器，供朋友小范围使用。部署方式为 Docker Compose：`app` 提供网站和 API，Caddy 负责 HTTPS，SQLite 数据库和照片保存在 Docker 命名卷中。当前没有部署到云端，以下步骤需要部署者在目标服务器执行并验收。

## 部署前准备

- 一台 Ubuntu 22.04/24.04 服务器，建议至少 2 核、2 GB 内存，并留出数据库、照片和备份所需磁盘空间。
- 已安装 Docker Engine 和 Docker Compose v2；执行 `docker version`、`docker compose version` 和 `docker info` 均成功。安装方法见 [Docker 官方 Ubuntu 文档](https://docs.docker.com/engine/install/ubuntu/)。
- 一个指向服务器公网 IP 的域名，以及用于 HTTPS 证书通知的真实邮箱。若存在 AAAA 记录，IPv6 也必须能到达本机，否则删除错误记录。
- 云服务器安全组放行 TCP 80、443；按需放行 UDP 443。SSH 22 仅对管理者开放。不要对公网开放应用端口 3001 或开发端口 5173。
- 服务器允许访问 Docker Hub、npm 和证书签发服务。中国大陆地域的域名对外提供网站通常需要先完成 ICP 备案，按云服务商要求办理。

把仓库源码或 `dashui-club-source.zip` 交给部署者。**不要上传本地的 `data/`、`node_modules/`、`dist/`、`.env`、测试数据库或备份。** 源码压缩包已排除这些内容。线上应使用全新的数据卷。

## 1. 上传源码

以下以压缩包已传到服务器当前目录为例；如果使用 Git，克隆后直接进入项目根目录即可。

```bash
sudo mkdir -p /opt/dashui-club
sudo unzip dashui-club-source.zip -d /opt/dashui-club
sudo chown -R "$(id -u):$(id -g)" /opt/dashui-club
cd /opt/dashui-club
```

`/opt/dashui-club` 中应能看到 `compose.yaml`、`Dockerfile`、`Caddyfile`、`package-lock.json`、`src/` 和 `server/`。后续命令都在此目录执行。若当前账号没有 Docker 权限，使用已配置 Docker 权限的账号，或在下文的 Docker 命令前加 `sudo`。

## 2. 配置域名与 HTTPS

先在域名服务商处将 A 记录指向这台服务器。等待 DNS 生效后创建环境文件：

```bash
cp .env.example .env
chmod 600 .env
nano .env
```

将示例值替换为真实信息：

```dotenv
DOMAIN=community.your-domain.com
ACME_EMAIL=your-real-email@example.com
```

`DOMAIN` 只写域名，不带 `https://`、端口、路径或末尾斜杠。`ACME_EMAIL` 用于证书通知。不要把 `.env` 提交到 Git 或发给其他人。

## 3. 启动并检查

```bash
docker compose config --quiet
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 app caddy
```

首次构建和签发证书可能需要几分钟。`docker compose ps` 中 `app` 应为 healthy，`caddy` 应为 running。浏览器打开 `https://你的域名`；不要用服务器 IP 或 HTTP 测试登录，因为生产会话 Cookie 只通过 HTTPS 发送。

将下面命令中的域名换成实际域名，健康检查应返回 `{"status":"ok"}`：

```bash
curl -fsS https://community.your-domain.com/api/health
```

若健康检查失败，先查看 `docker compose logs --tail=200 app caddy`，再检查 DNS、80/443 安全组、防火墙和证书签发日志。不要通过关闭 HTTPS、鉴权或来源校验来绕过问题。

## 4. 上线验收

请部署者和站点负责人用两个独立浏览器或无痕窗口完成以下检查：

1. 注册两个新账号，确认首页与社区没有示例账号内容。
2. 账号 A 创建带照片的记录，保持默认“仅自己可见”；账号 B 在社区中看不到记录，也无法通过照片地址查看照片。
3. A 将记录改为公开；B 能看到、点赞和评论。A 再改回私密；B 无法继续查看该记录和照片。
4. A 查看个人日历和趋势、导出自己的记录，并确认退出后需要重新登录。
5. 用手机宽度打开首页、打卡表单和社区，确认按钮、文字和底部导航可正常使用。

线上初始数据库为空，不提供默认管理员或共享体验账号。应用面向单台服务器、单个应用实例；不要把多个 `app` 副本挂在同一个 SQLite 文件上。

## 5. 备份与恢复

数据库包含用户、密码哈希、会话、记录、评论和照片。不要直接复制运行中的 SQLite 主文件；使用项目内的在线备份脚本获取一致性副本：

```bash
docker compose exec -T app node server/backup.js /app/data/backups/latest.sqlite
docker compose cp app:/app/data/backups/latest.sqlite ./community-backup.sqlite
```

把 `community-backup.sqlite` 再传到另一台机器或私有对象存储，限制访问，并按日期保留多个版本。建议每天备份，定期在隔离环境验证备份可以恢复。**不要运行 `docker compose down -v`**，它会删除数据库和证书命名卷。

恢复会让站点回退到备份时间点，必须先停应用。先确认备份文件存在且非空，并保留当前数据库的另一份备份：

```bash
test -s community-backup.sqlite
docker compose stop app
docker compose run --rm --no-deps --user root -v "$PWD/community-backup.sqlite:/restore.sqlite:ro" app sh -c 'cp /restore.sqlite /app/data/community.sqlite && rm -f /app/data/community.sqlite-wal /app/data/community.sqlite-shm && chown node:node /app/data/community.sqlite'
docker compose up -d app
docker compose ps
```

恢复后重新执行健康检查和账号登录验收。

## 6. 更新版本

先做备份，再上传新源码（或在仓库拉取新版本）：

```bash
docker compose exec -T app node server/backup.js /app/data/backups/pre-update.sqlite
docker compose cp app:/app/data/backups/pre-update.sqlite ./community-pre-update.sqlite
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 app caddy
```

更新后重新检查 HTTPS、登录、私密记录和公开社区。当前数据库使用幂等建表；未来修改已有表结构时，需要配套迁移脚本，不能只修改建表 SQL。

## 已知边界与排错

- 当前适合朋友内测，但注册入口仍对所有能访问网站的人开放，尚无邀请制。公开面向陌生用户前，需补充邮箱验证、找回密码、账号注销、举报和内容管理流程。
- `413` 或照片上传失败：每条记录最多一张 5 MB 的 JPG、PNG 或 WebP，图片像素上限 2500 万。
- 登录后仍显示未登录：检查是否通过与 `.env` 中 `DOMAIN` 完全一致的 HTTPS 域名访问。
- 保存时提示来源不受信任：检查浏览器 Origin；Compose 已将 `APP_ORIGIN` 设置为 `https://DOMAIN`。
- 镜像或 npm 下载超时：配置云服务商允许的镜像仓库或网络出口，再重新构建。
- 本机已通过 `npm run build` 和 API 集成测试；本机没有 Docker，因此镜像构建、云服务器网络、证书签发和真实上线验收仍需部署者完成。
