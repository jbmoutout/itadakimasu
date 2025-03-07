/*
  Warnings:

  - You are about to drop the `GatheredItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PantryItem` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "GatheredItem" DROP CONSTRAINT "GatheredItem_ingredientId_fkey";

-- DropForeignKey
ALTER TABLE "GatheredItem" DROP CONSTRAINT "GatheredItem_recipeId_fkey";

-- DropForeignKey
ALTER TABLE "GatheredItem" DROP CONSTRAINT "GatheredItem_userId_fkey";

-- DropForeignKey
ALTER TABLE "PantryItem" DROP CONSTRAINT "PantryItem_ingredientId_fkey";

-- DropForeignKey
ALTER TABLE "PantryItem" DROP CONSTRAINT "PantryItem_userId_fkey";

-- DropTable
DROP TABLE "GatheredItem";

-- DropTable
DROP TABLE "PantryItem";
