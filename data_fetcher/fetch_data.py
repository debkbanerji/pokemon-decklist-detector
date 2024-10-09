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

api_key_file = open("pokemontcg_api_key.txt", "r")
api_key = api_key_file.read().strip()

PokemonTCGSDKRestClient.configure(api_key)

PAGE_SIZE = 250

prefix_replacement_regex = re.compile(r"^(special delivery|radiant|origin forme|hisuian|galarian|alolan|teal mask|hearthflame mask|wellspring mask|cornerstone mask|bloodmoon|lance's|dark) ", re.IGNORECASE)
postfix_replacement_regex = re.compile(r" (ex|v|vstar|vmax)$", re.IGNORECASE)

professors_research_named_regex = re.compile(r"professor's research \(.*\)$", re.IGNORECASE)
boss_orders_named_regex = re.compile(r"^boss's orders \(.*\)$", re.IGNORECASE)
basic_energy_regex = re.compile(r"^basic .* energy$", re.IGNORECASE)
basic_energy_replacement_regex = re.compile(r"^basic ", re.IGNORECASE)

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
}


# Around 5000 cards last time I ran this!
def get_cards(): # Returns dataframe
    dfs_list = []
    total_downloaded_cards = 0
    page_number = 1
    processed_cards = None
    while processed_cards is None or len(processed_cards) > 0:
        query = 'legalities.standard:legal'
        # query = 'set.id:swsh9 ' + query # Uncomment for smaller test set (second ex: 'name:arceus')
        # query = '(name:dialga OR name:greninja OR name:basculin OR name:beldum OR name:metang) ' + query # Uncomment for smaller test set (second ex: 'name:arceus')
        full_card_objects = Card.where(page=page_number, pageSize=PAGE_SIZE, q=query) # All standard legal cards

        processed_cards = [
            {
                "id": card.id,
                "name": get_processed_name(card.name),
                "name_without_prefix": re.sub(prefix_replacement_regex, '', get_processed_name(card.name)),
                "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_processed_name(card.name))),
                "supertype": card.supertype,
                "set_id": card.set.id,
                "set_code": set_id_to_official_code_overrides[card.set.id]  if card.set.id in set_id_to_official_code_overrides else card.set.ptcgoCode,
                "regulation_mark": card.regulationMark,
                "set_name": card.set.name,
                "number": card.number,
                "set_printed_total": card.set.printedTotal, # The total printed on the card - excludes secret rares
                "small_image_url": card.images.small,
                "types": card.types
            } for card in full_card_objects
        ]
        dfs_list.append(pd.DataFrame(processed_cards))
        page_number = page_number + 1
        total_downloaded_cards = total_downloaded_cards + len(processed_cards)
        print("Downloaded info for " + str(total_downloaded_cards) + " cards")

    concatenated_df = pd.concat(dfs_list, ignore_index=True)

    print("Finished downloading info for " + str(concatenated_df.shape[0]) + " cards")
    return concatenated_df

def download_missing_card_images_for_df(cards_df):
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

if __name__ == '__main__':
    cards = get_cards()
    cards_df = pd.DataFrame(cards)

    download_missing_card_images_for_df(cards_df)

    cards_dict = {}
    for i, card in cards_df.iterrows():
        cards_dict[card['id']] = card.to_dict()
    with open('../client/public/card_database.json', 'w') as f:
        json.dump(cards_dict, f)

    print("Done!")
