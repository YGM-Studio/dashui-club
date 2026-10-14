# club.1gemo.com 运维

中国站使用独立 Node 24 容器和现有 Nginx，单实例运行。来源仓库为 staiv1/dashui-club，本仓库保存中国站的发布适配。更新由操作者从 main 制作 tag、执行 China release image 工作流、验证并发布正式 Release 后手动上线；没有推送即部署的 webhook。

数据库和压缩照片位于 `/srv/dashui-club/data/community.sqlite`。挂载目录独立于应用镜像；容器更新、停止和恢复均不删除数据库。目录归容器 node 用户，权限 0700。应用 512 MiB 内存、无额外容器 Swap、最多 1 CPU；照片处理并发 2，入口最多同时处理两个记录写入请求，忙时返回 429。容器日志 10 MiB × 3，Nginx 日志每日或超过 10 MiB 时轮转，保留 3 份；轮转阈值不是磁盘硬配额。

2026-10-14 用户明确要求本期不启用数据库备份。中国站不生成数据库备份，不安装备份定时任务，也不运行备份恢复演练。上游 DEPLOY.md 的备份步骤为通用部署建议，未在中国站启用。

## 停用和恢复

SSH 登录服务器后：

```sh
sudo clubctl status
sudo clubctl stop
sudo clubctl start
```

`stop` 先将域名切换为 503 停用说明，再停止该项目容器；保留数据库、运行镜像、证书及 DNS。Docker 的 unless-stopped 策略保持应用停用状态。`start` 启动原容器，等待健康检查后恢复入口，保持 bushu 的镜像引用和容器配置；容器已被删除时须通过正式发布恢复。这两个命令不执行数据备份或删除。

停用不设置自动删除日期。完整数据交接或永久删除需另行授权。公开 JSON 导出不含照片二进制；如需完整数据库文件，应先停止应用并确认没有写入，再交接数据库及相关 SQLite 文件，不直接复制正在写入的主文件。

## 发布和回滚

工作流只接受 main 上已有的 `vX.Y.Z-cn.N` tag，输出 Linux amd64 镜像、配置、manifest 和 SHA256SUMS 到草稿 Release。核验后发布正式 Release，才可进入服务器。服务器不执行 npm 安装或镜像构建。

校验 SHA256SUMS，使用 `docker load` 安装镜像，核对 revision 标签和 manifest。不同 Docker 版本导入时可能重写配置元数据并改变 image ID；归档配置摘要必须与 CI manifest 一致，导入后的文件层和完整运行配置也必须一致，并记录目标机 image ID。将 `/srv/dashui-club/.env` 的 CLUB_IMAGE 设置为固定 sha 镜像，在 bushu 的 `dashui-club-cn` 项目发布对应提交。bushu 可靠 Compose 发布保留最近两版配置和镜像，数据目录原位保留，版本接口报告实际运行 SHA。首次发布前先安装域名证书及项目配置。

应用回滚不会恢复数据库。当前版本使用原有表结构，声明兼容；未来发生数据库结构变化时须重新核对兼容性，不沿用本次声明。

关联任务：[CLUB-1](https://app.plane.so/skyadmin/browse/CLUB-1/)。
