from pokemontcgsdk import RestClient as PokemonTCGSDKRestClient
from pokemontcgsdk import Card
import pandas as pd
import urllib
import os
import re
import shutil
import json

DATA_DIRECTORY = './data'
CARD_IMAGES_DIRECTORY = DATA_DIRECTORY + '/card-images'
if not os.path.exists(CARD_IMAGES_DIRECTORY):
    os.makedirs(CARD_IMAGES_DIRECTORY)
CLIENT_CARD_IMAGES_DIRECTORY = './../client/public/cards'
if not os.path.exists(CLIENT_CARD_IMAGES_DIRECTORY):
    os.makedirs(CLIENT_CARD_IMAGES_DIRECTORY)

SPRITES_DIRECTORY = DATA_DIRECTORY + '/sprites'
if not os.path.exists(SPRITES_DIRECTORY):
    os.makedirs(SPRITES_DIRECTORY)
CLIENT_SPRITES_DIRECTORY = './../client/public/sprites'
if not os.path.exists(CLIENT_SPRITES_DIRECTORY):
    os.makedirs(CLIENT_SPRITES_DIRECTORY)

api_key_file = open("pokemontcg_api_key.txt", "r")
api_key = api_key_file.read().strip()

PokemonTCGSDKRestClient.configure(api_key)

PAGE_SIZE = 250

prefix_replacement_regex = re.compile(r"^((special delivery|radiant|origin forme|hisuian|galarian|alolan|paldean|teal mask|hearthflame mask|wellspring mask|cornerstone mask|bloodmoon|lance's|single strike|rapid strike|ice rider|shadow rider|flying|surfing|heat|mow|wash|fan|frost|black|white) )*", re.IGNORECASE)
postfix_replacement_regex = re.compile(r" (ex|v|vstar|vmax|v-union|sunny form|rainy form|snowy form|with grey felt hat)$", re.IGNORECASE)

professors_research_named_regex = re.compile(r"professor's research \(.*\)$", re.IGNORECASE)
boss_orders_named_regex = re.compile(r"^boss's orders \(.*\)$", re.IGNORECASE)
basic_energy_regex = re.compile(r"^basic .* energy$", re.IGNORECASE)
basic_energy_replacement_regex = re.compile(r"^basic ", re.IGNORECASE)
sprite_url_replacement_regex = re.compile(r"(\'|\.)", re.IGNORECASE)


owner_replacement_regex = re.compile(r"^((N|Iono|Lillie|Hop|Marnie|Steven|Arven|Misty|Ethan|Cynthia|Team Rocket)'s )*", re.IGNORECASE)

# If the card is a pokemon, remove the owner name from the beginning
# Leave in owner names for trainers
# Note that the owner name is part of the card name for decklist purposes, so should not always be stripped out
def get_maybe_trainer_removed_name(name, supertype):
    return re.sub(owner_replacement_regex, '', name) if supertype == 'Pokémon' else name


# Does basic name processing, but does not remove prefix/postfixes that should be part of the core name
def get_processed_name(name):
    if professors_research_named_regex.match(name):
        return "Professor's Research"
    if boss_orders_named_regex.match(name):
        return "Boss's Orders"
    if basic_energy_regex.match(name):
        return re.sub(basic_energy_replacement_regex, "", name)
    return name

set_id_to_official_code_overrides = {
  "swshp": "PR", # sword and shield promos
  "svp": "SVP", # scarlet and violet promos
  "sv1": "SVI",
  "sv2": "PAL",
  "sv3": "OBF",
  "sv3pt5": "MEW",
  "sv4": "PAR",
  "sv4pt5": "PAF",
  "sv5": "TEF",
  "sv6": "TWM",
  "sv6pt5": "SFA",
  "sv7": "SCR",
  "sv8": "SSP",
  "sv8pt5": "PRE",
  "sv9": "JTG",
}


# Around 5000 cards last time I ran this!
def get_cards(): # Returns dataframe
    dfs_list = []
    total_downloaded_cards = 0
    page_number = 1
    processed_cards = None
    while processed_cards is None or len(processed_cards) > 0:
        query = 'legalities.standard:legal'
        query = '(regulationMark:g OR regulationMark:h OR regulationMark:i OR name:basic) ' + query
        # query = 'set.id:swsh9 ' + query # Uncomment for smaller test set (second ex: 'name:arceus')
        # query = '(name:dialga OR name:greninja OR name:basculin OR name:beldum OR name:metang) ' + query # Uncomment for smaller test set (second ex: 'name:arceus')
        full_card_objects = Card.where(page=page_number, pageSize=PAGE_SIZE, q=query) # All standard legal cards

        processed_cards = [
            {
                "id": card.id,
                "name": get_processed_name(card.name),
                "name_without_prefix": re.sub(prefix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name(card.name), card.supertype)),
                "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name(card.name), card.supertype))),
                "supertype": card.supertype,
                "hp": card.hp,
                "set_id": card.set.id,
                "set_code": set_id_to_official_code_overrides[card.set.id]  if card.set.id in set_id_to_official_code_overrides else card.set.ptcgoCode,
                "regulation_mark": card.regulationMark,
                "set_name": card.set.name,
                "number": card.number,
                "set_printed_total": card.set.printedTotal, # The total printed on the card - excludes secret rares
                "small_image_url": card.images.small,
                "types": card.types,
                "national_pokedex_numbers": card.nationalPokedexNumbers
            } for card in full_card_objects
        ]
        dfs_list.append(pd.DataFrame(processed_cards))
        page_number = page_number + 1
        total_downloaded_cards = total_downloaded_cards + len(processed_cards)
        print("Downloaded info for " + str(total_downloaded_cards) + " cards")

    
    # Lugia V from Crown Zenith is missing from the DB! Add it in manually:
    manual_fixes_df = pd.DataFrame([
        {
            "id": 'svp-166',
            "name": "Teal Mask Ogerpon ex",
            "name_without_prefix": re.sub(prefix_replacement_regex, '', get_processed_name("Teal Mask Ogerpon ex")),
            "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_processed_name("Teal Mask Ogerpon ex"))),
            "supertype": "Pokémon",
            "hp": "210",
            "set_id": "svp",
            "set_code": "SVP",
            "regulation_mark": "H",
            "set_name": "Scarlet & Violet Black Star Promos",
            "number": "166",
            "set_printed_total": 177, # The total printed on the card - excludes secret rares
            "small_image_url": "https://tcgplayer-cdn.tcgplayer.com/product/596439_in_1000x1000.jpg",
            "types": ['Grass'],
            "national_pokedex_numbers": [1017]
        },
        {
            "id": 'svp-177',
            "name": "Bloodmoon Ursaluna ex",
            "name_without_prefix": re.sub(prefix_replacement_regex, '', get_processed_name("Bloodmoon Ursaluna ex")),
            "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_processed_name("Bloodmoon Ursaluna ex"))),
            "supertype": "Pokémon",
            "hp": "260",
            "set_id": "svp",
            "set_code": "SVP",
            "regulation_mark": "H",
            "set_name": "Scarlet & Violet Black Star Promos",
            "number": "177",
            "set_printed_total": 177, # The total printed on the card - excludes secret rares
            "small_image_url": "https://tcgplayer-cdn.tcgplayer.com/product/595473_in_1000x1000.jpg",
            "types": ['Colorless'],
            "national_pokedex_numbers": [901]
        },
        {
            "id": 'svp-193',
            "name": "Hop's Zacian ex",
            "name_without_prefix": re.sub(prefix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Hop's Zacian ex"), "Pokémon")),
            "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Hop's Zacian ex"), "Pokémon"))),
            "supertype": "Pokémon",
            "hp": "230",
            "set_id": "svp",
            "set_code": "SVP",
            "regulation_mark": "I",
            "set_name": "Scarlet & Violet Black Star Promos",
            "number": "193",
            "set_printed_total": 193, # The total printed on the card - excludes secret rares
            "small_image_url": "https://pkmncards.com/wp-content/uploads/svbsp_en_193_std.jpg",
            "types": ['Metal'],
            "national_pokedex_numbers": [888]
        },
        {
            "id": 'svp-194',
            "name": "Iono's Bellibolt ex",
            "name_without_prefix": re.sub(prefix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Iono's Bellibolt ex"), "Pokémon")),
            "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Iono's Bellibolt ex"), "Pokémon"))),
            "supertype": "Pokémon",
            "hp": "280",
            "set_id": "svp",
            "set_code": "SVP",
            "regulation_mark": "I",
            "set_name": "Scarlet & Violet Black Star Promos",
            "number": "194",
            "set_printed_total": 194, # The total printed on the card - excludes secret rares
            "small_image_url": "https://pkmncards.com/wp-content/uploads/svbsp_en_194_std.jpg",
            "types": ['Electric'],
            "national_pokedex_numbers": [939]
        }
    ])
    dfs_list.append(manual_fixes_df)

    concatenated_df = pd.concat(dfs_list, ignore_index=True)

    print("Finished downloading info for " + str(concatenated_df.shape[0]) + " cards")
    return concatenated_df

def download_missing_card_images_and_sprites_for_df(cards_df):
    print("Downloading image data")
    # Downloads images of cards for which the image does not already exist in CARD_IMAGES_DIRECTORY
    # Naturally, this function will download all the images if none of them exist
    opener = urllib.request.build_opener()
    opener.addheaders = [('X-Api-Key', api_key)]
    urllib.request.install_opener(opener)
    for index, card in cards_df.iterrows():
        file_name = card["id"] + ".png"
        img_path = CARD_IMAGES_DIRECTORY + "/" + file_name
        if not os.path.isfile(img_path):
            print("#" + str(index + 1) + ": Downloading " + card["small_image_url"] + " to " + img_path)
            urllib.request.urlretrieve(card["small_image_url"], img_path)
        else:
            print("#" + str(index + 1) + ": " + img_path + " already exists; skipping download")
        shutil.copy(img_path, CLIENT_CARD_IMAGES_DIRECTORY + "/" + file_name)

        if card["supertype"] == 'Pokémon':
            name_without_prefix_and_postfix = card["name_without_prefix_and_postfix"]
            sprite_file_name = re.sub(sprite_url_replacement_regex, '', name_without_prefix_and_postfix.lower().replace(" ", "-").replace("'", "").replace("é", "e").replace("♀", "f").replace("♂", "m")) + ".png"
            sprite_path = SPRITES_DIRECTORY + '/' + sprite_file_name
            sprite_url = 'https://limitlesstcg.s3.us-east-2.amazonaws.com/pokemon/gen9/' + sprite_file_name
            if not os.path.isfile(sprite_path):
                print("#" + str(index + 1) + ": Downloading " + sprite_url + " to " + sprite_path)
                urllib.request.urlretrieve(sprite_url, sprite_path)
            else:
                print("#" + str(index + 1) + ": " + sprite_path + " already exists; skipping download")
            shutil.copy(sprite_path, CLIENT_SPRITES_DIRECTORY + "/" + sprite_file_name)

    # for pokedex_number in range(0,1025 + 1): # Up to pecharunt
    #     sprite_file_name = str(pokedex_number) + ".png"
    #     sprite_path = SPRITES_DIRECTORY + '/' + sprite_file_name
    #     sprite_url = 'https://github.com/PokeAPI/sprites/blob/master/sprites/pokemon/other/home/' + sprite_file_name + '?raw=true'
    #     if not os.path.isfile(sprite_path):
    #         print("#" + str(index + 1) + ": Downloading " + sprite_url + " to " + sprite_path)
    #         urllib.request.urlretrieve(sprite_url, sprite_path)
    #     else:
    #         print("#" + str(index + 1) + ": " + sprite_path + " already exists; skipping download")
    #     shutil.copy(sprite_path, CLIENT_SPRITES_DIRECTORY + "/" + sprite_file_name)

if __name__ == '__main__':
    cards = get_cards()
    cards_df = pd.DataFrame(cards)

    download_missing_card_images_and_sprites_for_df(cards_df)

    cards_dict = {}
    for i, card in cards_df.iterrows():
        cards_dict[card['id']] = card.to_dict()
    with open('../client/public/card_database.json', 'w') as f:
        json.dump(cards_dict, f)

    print("Done!")
