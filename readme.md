# Img2color

本项目使用 Node.js 实现，图片处理基于 Sharp（libvips），兼容性好且适合 Serverless 环境

支持vercel与服务器部署

运行环境要求：Node.js 24.x+

## vercel部署

1. 点击项目右上角fork叉子

2. 登录[vercel](https://vercel.com/)

3. 在[vercel](https://vercel.com/)导入项目

4. 部署时添加环境变量

5. 国内访问需绑定自定义域名

## 服务器部署

需要 Node.js 24.x+ 环境

1. 安装依赖
```bash
npm install
```
2. 运行
```bash
PORT=3000 node src/server.ts
```
此处不赘述守护进程。

> 提示：本项目不再附带 `.env`，环境变量由部署平台（Vercel）或进程环境变量提供。未配置 `ALLOWED_REFERERS` 时不限制来源；一旦配置了白名单，未命中的请求会返回 403。

## 使用

例如：https://img2color-go.vercel.app/api?img=https://npm.elemecdn.com/anzhiyu-blog@1.1.6/img/post/banner/神里.webp

部署后只需要 域名/api 访问

必填参数img: url

环境变量配置说明（Vercel 在 Project Settings → Environment Variables 配置）


| 配置项                  | 说明                                 |
|-------------------------|--------------------------------------|
| REDIS_ADDRESS           | REDIS地址                            |
| REDIS_PASSWORD          | REDIS密码                            |
| USE_REDIS_CACHE         | bool值，是否启用REDIS                 |
| REDIS_DB                | REDIS数据库名                        |
| USE_MONGODB             | bool值，是否启用mongodb               |
| MONGO_URI               | mongodb地址                          |
| MONGO_DB                | mongodb数据库名                      |
| PORT                    | 端口                                 |
| ALLOWED_REFERERS        | 允许的refer域名，支持通配符，如果有多个地址可以用英文半角,隔开 |
