/*
  Warnings:

  - A unique constraint covering the columns `[englishName]` on the table `Ingredient` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[frenchName]` on the table `Ingredient` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Ingredient" ADD COLUMN     "englishName" TEXT,
ADD COLUMN     "frenchName" TEXT;

-- CreateTable
CREATE TABLE "IngredientSeason" (
    "id" SERIAL NOT NULL,
    "ingredientId" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "isInSeason" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngredientSeason_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IngredientSeason_ingredientId_month_key" ON "IngredientSeason"("ingredientId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_englishName_key" ON "Ingredient"("englishName");

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_frenchName_key" ON "Ingredient"("frenchName");

-- AddForeignKey
ALTER TABLE "IngredientSeason" ADD CONSTRAINT "IngredientSeason_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
