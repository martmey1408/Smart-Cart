import sys
import json
from fuzzywuzzy import fuzz

# Load your recipes from a JSON file or database
with open('recipes.json', 'r') as f:
    recipes = json.load(f)

def recommend_recipe(products):
    best_match = None
    best_score = 0
    
    for recipe in recipes:
        score = sum(max(fuzz.ratio(product, ingredient) for ingredient in recipe['ingredientes']) for product in products)
        if score > best_score:
            best_score = score
            best_match = recipe
    
    return best_match

if __name__ == '__main__':
    products = json.loads(sys.argv[1])
    recommended_recipe = recommend_recipe(products)
    print(json.dumps(recommended_recipe))