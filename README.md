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

## Features

### Weekly Planner
- **AI-Powered Meal Planning**: Uses Claude AI to select 5 optimal recipes for the week
- **Smart Criteria**: Prioritizes healthy, seasonal (France-based), and ingredient-efficient recipes
- **Interactive Selection**: Accept or reject individual recipes with alternative suggestions
- **Seasonal Awareness**: Highlights ingredients currently in season
- **Ingredient Efficiency**: Optimizes for shared ingredients across multiple recipes
- **User Preferences**: Considers starred/favorite recipes in recommendations

### Recipe Management
- **Recipe Collection**: Save and organize recipes from the web
- **Ingredient Extraction**: Automatic ingredient parsing with AI
- **Seasonal Tracking**: Track which ingredients are in season
- **Shopping Lists**: Generate organized shopping lists from selected recipes

### Shopping & Cooking
- **Saved Lists**: Create and manage multiple shopping lists
- **Ingredient Tracking**: Check off ingredients as you shop
- **Recipe Integration**: Link recipes to shopping lists
- **Progress Tracking**: Monitor cooking progress

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
