# File Converter

纯浏览器端的文件格式转换工具：图片、PDF、文档、表格、音视频都在本地处理，文件不会上传到任何服务器。

- 无后端、无账号、无广告
- 支持批量队列、实时进度、取消、多文件打包下载
- 深浅色主题，参数可保存
- 静态部署即可使用（GitHub Pages / 任意静态托管）

## 功能

| 分类 | 输入 | 输出 | 可选参数 |
| --- | --- | --- | --- |
| 图片 | PNG / JPG / WebP / AVIF / BMP / ICO / GIF | PNG / JPG / WebP / AVIF / BMP / ICO / PDF | 质量、最长边、透明转不透明时的背景色 |
| PDF | PDF | PNG / JPG / 拆分 PDF / 合并 PDF | 页面尺寸（跟随图片 / A4 / Letter）、方向、渲染 DPI、页码（如 `1-3,5`） |
| 文档 | Markdown / HTML / 纯文本 | HTML / Markdown / 纯文本 | 导出 HTML 的标题 |
| 表格 | CSV / TSV / JSON / XLSX / XLS | CSV / TSV / JSON / XLSX | 输出分隔符、首行是否作为表头 |
| 音视频 | MP4 / WebM / MOV / MKV / AVI / GIF / MP3 / WAV / M4A / OGG | MP4 / WebM / GIF / MP3 / WAV | 质量、输出分辨率、GIF 帧率 |

实现方式：

- 图片：Canvas 2D + [`@jsquash/avif`](https://github.com/jamsinclair/jSquash)（AVIF 编码），ICO/BMP 由内置编码器生成
- PDF：`pdf-lib`（合并、拆分、图片转 PDF）+ `pdfjs-dist`（PDF 渲染成图片）
- 文档：`marked` + `turndown`
- 表格：`papaparse` + `SheetJS`
- 音视频：`ffmpeg.wasm`（单线程内核，按需加载）
- 打包下载：`fflate`

## 开发

```bash
npm install
npm run dev        # 开发服务器
npm test           # 单元测试
npm run build      # 类型检查 + 生产构建
npm run preview    # 预览构建结果
```

需要 Node.js 18+。

## 部署

构建产物在 `dist/`，全部是静态文件，可直接放到任意静态托管。`vite.config.ts` 中 `base: './'` 使资源按相对路径加载，因此部署在子目录（例如 GitHub Pages 的 `/<repo>/`）也能正常工作。

## 项目结构

```
src/
├── components/          # 界面：拖拽区、队列、参数抽屉、页头
├── lib/
│   ├── convert/         # 各分类的转换实现
│   │   ├── image.ts
│   │   ├── pdf.ts
│   │   ├── docs.ts
│   │   ├── data.ts
│   │   └── media.ts
│   ├── formats.ts       # 格式定义与识别
│   ├── registry.ts      # 转换器注册表、可选目标、默认目标
│   ├── download.ts      # 单文件下载与 zip 打包
│   ├── settings.ts      # 参数默认值与持久化
│   ├── pages.ts         # 页码解析
│   └── types.ts
├── App.tsx              # 队列与状态编排
└── main.tsx
```

## 添加新格式

1. 在 `src/lib/formats.ts` 注册格式（`id`、扩展名、MIME、分类、能否作为输入/输出）。
2. 在 `src/lib/convert/` 实现转换函数：

```ts
import type { ConvertContext, OutputFile } from '../types'

export async function myConverter(ctx: ConvertContext): Promise<OutputFile[]> {
  const file = ctx.files[0]
  ctx.onProgress(0.5)
  return [{ name: 'output.bin', blob: new Blob([...]) }]
}
```

3. 在 `src/lib/registry.ts` 的 `CONVERTERS` 中登记 `from`/`to`，并在 `PREFERRED` 里给出默认目标（可选）。

## 已知限制

- 音视频转换使用单线程 FFmpeg WASM，首次使用会从 CDN 加载约 30MB 内核，需要联网；大文件转换较慢，且受浏览器内存限制。
- 图片经 Canvas 重新编码后会丢失 EXIF 等元数据；透明图片转 JPG/BMP 时按设定背景色填充。
- 加密/损坏的 PDF 会报错；扫描版 PDF 只渲染页面，不做 OCR。
- 不支持 HEIC、压缩包、电子书等格式。
- 推荐使用 Chrome / Edge 等 Chromium 内核浏览器；Safari 对部分格式的编码支持有限。

## License

MIT
