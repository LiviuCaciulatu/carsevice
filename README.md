This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Deployment notes (cPanel frontend + AWS backend)

This project can be deployed as a static frontend on cPanel and a small backend on AWS (recommended). Key points:

- Build & export the frontend: `npm run build && npx next export` and upload the `out/` folder to your cPanel `public_html/`.
- Use `NEXT_PUBLIC_API_BASE_URL` to point the frontend to your API host (API Gateway / Lambda URL).
- Deploy backend routes as AWS Lambda functions (or a small VPS) and use SNS + Textract StartDocumentTextDetection for PDFs.
- Configure `AWS_TEXTRACT_SNS_TOPIC_ARN` and `AWS_TEXTRACT_ROLE_ARN` for async PDF processing.

See the repo CI workflow `.github/workflows/ci.yml` for TypeScript + lint checks.
