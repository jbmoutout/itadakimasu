-- CreateTable
CREATE TABLE "SavedRecipeList" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Shopping List',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "SavedRecipeList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedIngredient" (
    "id" SERIAL NOT NULL,
    "savedListId" INTEGER NOT NULL,
    "ingredientId" INTEGER NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'groceries',
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_RecipeToSavedRecipeList" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_RecipeToSavedRecipeList_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "SavedRecipeList_userId_idx" ON "SavedRecipeList"("userId");

-- CreateIndex
CREATE INDEX "SavedIngredient_savedListId_idx" ON "SavedIngredient"("savedListId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedIngredient_savedListId_ingredientId_key" ON "SavedIngredient"("savedListId", "ingredientId");

-- CreateIndex
CREATE INDEX "_RecipeToSavedRecipeList_B_index" ON "_RecipeToSavedRecipeList"("B");

-- AddForeignKey
ALTER TABLE "SavedRecipeList" ADD CONSTRAINT "SavedRecipeList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedIngredient" ADD CONSTRAINT "SavedIngredient_savedListId_fkey" FOREIGN KEY ("savedListId") REFERENCES "SavedRecipeList"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedIngredient" ADD CONSTRAINT "SavedIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RecipeToSavedRecipeList" ADD CONSTRAINT "_RecipeToSavedRecipeList_A_fkey" FOREIGN KEY ("A") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RecipeToSavedRecipeList" ADD CONSTRAINT "_RecipeToSavedRecipeList_B_fkey" FOREIGN KEY ("B") REFERENCES "SavedRecipeList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
