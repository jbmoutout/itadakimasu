/*
  Warnings:

  - A unique constraint covering the columns `[url,userId]` on the table `Recipe` will be added. If there are existing duplicate values, this will fail.
  - Made the column `userId` on table `Recipe` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Recipe" ALTER COLUMN "userId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_url_userId_key" ON "Recipe"("url", "userId");

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
