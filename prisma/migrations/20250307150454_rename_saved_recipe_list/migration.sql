/*
  Warnings:

  - You are about to drop the `SavedRecipeList` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_RecipeToSavedRecipeList` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "SavedIngredient" DROP CONSTRAINT "SavedIngredient_savedListId_fkey";

-- DropForeignKey
ALTER TABLE "SavedRecipeList" DROP CONSTRAINT "SavedRecipeList_userId_fkey";

-- DropForeignKey
ALTER TABLE "_RecipeToSavedRecipeList" DROP CONSTRAINT "_RecipeToSavedRecipeList_A_fkey";

-- DropForeignKey
ALTER TABLE "_RecipeToSavedRecipeList" DROP CONSTRAINT "_RecipeToSavedRecipeList_B_fkey";

-- DropTable
DROP TABLE "SavedRecipeList";

-- DropTable
DROP TABLE "_RecipeToSavedRecipeList";

-- CreateTable
CREATE TABLE "SavedList" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Shopping List',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "SavedList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_RecipeToSavedList" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_RecipeToSavedList_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "SavedList_userId_idx" ON "SavedList"("userId");

-- CreateIndex
CREATE INDEX "_RecipeToSavedList_B_index" ON "_RecipeToSavedList"("B");

-- AddForeignKey
ALTER TABLE "SavedList" ADD CONSTRAINT "SavedList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedIngredient" ADD CONSTRAINT "SavedIngredient_savedListId_fkey" FOREIGN KEY ("savedListId") REFERENCES "SavedList"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RecipeToSavedList" ADD CONSTRAINT "_RecipeToSavedList_A_fkey" FOREIGN KEY ("A") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RecipeToSavedList" ADD CONSTRAINT "_RecipeToSavedList_B_fkey" FOREIGN KEY ("B") REFERENCES "SavedList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
