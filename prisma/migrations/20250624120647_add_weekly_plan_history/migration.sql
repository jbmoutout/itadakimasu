-- CreateTable
CREATE TABLE "WeeklyPlanHistory" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "recipeId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "planDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyPlanHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeeklyPlanHistory_userId_planDate_idx" ON "WeeklyPlanHistory"("userId", "planDate");

-- CreateIndex
CREATE INDEX "WeeklyPlanHistory_recipeId_status_idx" ON "WeeklyPlanHistory"("recipeId", "status");

-- CreateIndex
CREATE INDEX "WeeklyPlanHistory_createdAt_idx" ON "WeeklyPlanHistory"("createdAt");

-- AddForeignKey
ALTER TABLE "WeeklyPlanHistory" ADD CONSTRAINT "WeeklyPlanHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyPlanHistory" ADD CONSTRAINT "WeeklyPlanHistory_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
