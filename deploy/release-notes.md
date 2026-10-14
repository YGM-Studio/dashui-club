club.1gemo.com 中国区部署版本，来源为 staiv1/dashui-club main 提交 270ca4662a89f9107b105a0b5f5535a507bcebec。停用后恢复直接启动原容器，保留可靠发布的配置和镜像引用；制品 manifest 增加跨 Docker 版本的文件层及运行配置校验信息。

Node 24 单实例，独立 SQLite 持久化目录，512 MiB 内存、1 CPU、图片处理并发 2。现有 Nginx 提供 HTTPS，应用端口只绑定服务器回环地址。新增发布版本识别、运行日志限制和保留数据的停用/恢复命令。

用户要求本期不启用数据库备份；此版本不创建备份、备份定时任务或备份恢复演练。停用保留原数据库，数据最终删除需另行授权。

关联任务：https://app.plane.so/skyadmin/browse/CLUB-1/
