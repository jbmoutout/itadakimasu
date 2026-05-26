import type { PrismaClient } from "@prisma/client";

export interface CheckedIngredientSource {
  getCheckedIngredientNames(userId: number): Promise<string[]>;
}

export class ShoppingListCheckedIngredients implements CheckedIngredientSource {
  constructor(private prisma: PrismaClient) {}

  async getCheckedIngredientNames(userId: number): Promise<string[]> {
    const items = await this.prisma.shoppingList.findMany({
      where: { userId, checked: true },
      take: 50,
    });

    const names: string[] = [];
    for (const item of items) {
      try {
        const data = item.data as { name?: string } | null;
        if (data?.name) {
          names.push(data.name.toLowerCase());
        }
      } catch {
        // skip malformed entries
      }
    }
    return names;
  }
}
