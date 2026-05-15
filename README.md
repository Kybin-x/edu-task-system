# 实训任务管理系统

中职电子商务专业课堂任务发布与成绩登记系统。

## 功能

- **打分登记**：宫格/列表双视图，实时预览系数计算
- **任务管理**：发布任务，结束登记，自动补零
- **成绩查询**：班级汇总，一键导出 CSV
- **数据管理**：班级学生管理，支持批量导入

## 本地开发

```bash
npm install
npm run dev
```

## 部署到 Cloudflare Pages

1. 将代码推送到 GitHub
2. 在 Cloudflare Pages 连接 GitHub 仓库
3. 构建配置：
   - **Framework preset**: Vite
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. 保存并部署

## 数据存储

数据保存在浏览器 `localStorage`，无需后端服务器。
