import pandas as pd
import urllib
import urllib.request
import os
import re
import shutil
import json
import math
from PIL import Image, ImageDraw, ImageOps

DATA_DIRECTORY = './data'
CARD_IMAGES_DIRECTORY = DATA_DIRECTORY + '/card-images'
if not os.path.exists(CARD_IMAGES_DIRECTORY):
    os.makedirs(CARD_IMAGES_DIRECTORY)
CLIENT_CARD_IMAGES_DIRECTORY = './../client/public/cards'
if not os.path.exists(CLIENT_CARD_IMAGES_DIRECTORY):
    os.makedirs(CLIENT_CARD_IMAGES_DIRECTORY)
CLIENT_SPECIAL_ENERGY_SYMBOLS_DIRECTORY = './../client/public/special-energy-symbols'
if not os.path.exists(CLIENT_SPECIAL_ENERGY_SYMBOLS_DIRECTORY):
    os.makedirs(CLIENT_SPECIAL_ENERGY_SYMBOLS_DIRECTORY)
CLIENT_TRAINER_SYMBOLS_DIRECTORY = './../client/public/trainer-symbols'
if not os.path.exists(CLIENT_TRAINER_SYMBOLS_DIRECTORY):
    os.makedirs(CLIENT_TRAINER_SYMBOLS_DIRECTORY)

SPRITES_DIRECTORY = DATA_DIRECTORY + '/sprites'
if not os.path.exists(SPRITES_DIRECTORY):
    os.makedirs(SPRITES_DIRECTORY)
CLIENT_SPRITES_DIRECTORY = './../client/public/sprites'
if not os.path.exists(CLIENT_SPRITES_DIRECTORY):
    os.makedirs(CLIENT_SPRITES_DIRECTORY)

PAGE_SIZE = 250

prefix_replacement_regex = re.compile(r"^((special delivery|radiant|origin forme|hisuian|galarian|alolan|paldean|teal mask|hearthflame mask|wellspring mask|cornerstone mask|bloodmoon|lance's|single strike|rapid strike|ice rider|shadow rider|flying|surfing|heat|mow|wash|fan|frost|white|mega) )*", re.IGNORECASE)
postfix_replacement_regex = re.compile(r" (ex|X ex|Y ex|Z ex|v|vstar|vmax|v-union|sunny form|rainy form|snowy form|with grey felt hat)$", re.IGNORECASE)

professors_research_named_regex = re.compile(r"professor's research \(.*\)$", re.IGNORECASE)
boss_orders_named_regex = re.compile(r"^boss's orders \(.*\)$", re.IGNORECASE)
basic_energy_regex = re.compile(r"^basic .* energy$", re.IGNORECASE)
basic_energy_replacement_regex = re.compile(r"^basic ", re.IGNORECASE)
sprite_url_replacement_regex = re.compile(r"(\'|\.|:)", re.IGNORECASE)


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

BASIC_ENERGY_NAMES = [
    "Grass Energy",
    "Fire Energy",
    "Water Energy",
    "Lightning Energy",
    "Psychic Energy",
    "Fighting Energy",
    "Darkness Energy",
    "Metal Energy"
]

def convert_int_or_infinity(s):
    try:
        i = int(s)
    except ValueError:
        i = math.inf
    return i


# Around 5000 cards last time I ran this!
def get_cards(): # Returns dataframe
    dfs_list = []
    total_downloaded_cards = 0
    page_number = 1
    processed_cards = None
    
    # get the set info directly from github, to avoid computationally expensive calls to the API
    sets_url = "https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/refs/heads/master/sets/en.json"
    sets_data = json.load(urllib.request.urlopen(sets_url))
    
    # only Scarlet & Violet and Mega Evolution sets are currently supported 
    sets_data = [s for s in sets_data if s['series'] == 'Scarlet & Violet' or s['series'] == 'Mega Evolution']

    for set_data in sets_data:
        set_id = set_data['id']
        print("Downloading info for set " + set_id + " (" + set_data['name'] + ")")
        set_url = "https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/refs/heads/master/cards/en/" + set_id + ".json"
        cards_in_set = json.load(urllib.request.urlopen(set_url))
        processed_cards = [
            {
                "id": card.get('id'),
                "name": get_processed_name(card.get('name')),
                "name_without_prefix": re.sub(prefix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name(card.get('name')), card.get('supertype'))) if card.get('supertype') == 'Pokémon' else get_processed_name(card.get('name')),
                "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name(card.get('name')), card.get('supertype')))) if card.get('supertype') == 'Pokémon' else get_processed_name(card.get('name')),
                "supertype": card.get('supertype'),
                "subtypes": card.get('subtypes', []),
                "rarity": card.get('rarity'),
                "rarity_for_mismatch_correction" : get_rarity_for_mismatch_correction(card.get('id'), card.get('rarity')) ,
                "hp": card.get('hp'),
                "set_id": set_data.get('id'),
                "set_code": set_id_to_official_code_overrides[set_data.get('id')] if set_data.get('id') in set_id_to_official_code_overrides else set_data.get('ptcgoCode'),
                "regulation_mark": card.get('regulationMark'),
                "set_name": set_data.get('name'),
                "number": card.get('number'),
                "set_printed_total": set_data.get('printedTotal'),
                "small_image_url": card.get('images', {}).get('small'),
                "types": card.get('types'),
                "national_pokedex_numbers": card.get('nationalPokedexNumbers'),
                # weird hack - we only use this to match between cards in order to warn users about similar cards that *may* only differ by set info
                "concatenated_attack_names": 
                    '_'.join([attack.get('name') for attack in card.get('attacks')]) if card.get('attacks') and len(card.get('attacks')) > 0 else None,
            } for card in cards_in_set
        ]
        dfs_list.append(pd.DataFrame(processed_cards))
        page_number = page_number + 1
        total_downloaded_cards = total_downloaded_cards + len(processed_cards)
        print("Downloaded info for " + str(total_downloaded_cards) + " cards")

    
    # Some promos missing from the DB! Add it in manually:
    manual_fixes_df = pd.DataFrame([
        {
            "id": 'svp-166',
            "name": "Teal Mask Ogerpon ex",
            "name_without_prefix": re.sub(prefix_replacement_regex, '', get_processed_name("Teal Mask Ogerpon ex")),
            "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_processed_name("Teal Mask Ogerpon ex"))),
            "supertype": "Pokémon",
            "subtypes": ['Basic', 'Tera', 'ex'],
            "rarity": "Promo",
            "hp": "210",
            "set_id": "svp",
            "set_code": "SVP",
            "regulation_mark": "H",
            "set_name": "Scarlet & Violet Black Star Promos",
            "number": "166",
            "concatenated_attack_names": "Myriad Leaf Shower", # used to match the card to the very similar looking regular set version
            "set_printed_total": 177, # The total printed on the card - excludes secret rares
            "small_image_url": "https://tcgplayer-cdn.tcgplayer.com/product/596439_in_1000x1000.jpg",
            "types": ['Grass'],
            "national_pokedex_numbers": [1017]
        },
        {
            "id": 'svp-173',
            "name": "Eevee",
            "name_without_prefix": re.sub(prefix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Eevee"), "Pokémon")),
            "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Eevee"), "Pokémon"))),
            "supertype": "Pokémon",
            "subtypes": ['Basic'],
            "rarity": "Promo",
            "hp": "50",
            "set_id": "svp",
            "set_code": "SVP",
            "regulation_mark": "H",
            "set_name": "Scarlet & Violet Black Star Promos",
            "number": "173",
            "set_printed_total": 173,
            "small_image_url": "https://pkmncards.com/wp-content/uploads/svbsp_en_173_std.jpg",
            "types": ['Colorless'],
            "national_pokedex_numbers": [133]
        },
        {
            "id": 'svp-177',
            "name": "Bloodmoon Ursaluna ex",
            "name_without_prefix": re.sub(prefix_replacement_regex, '', get_processed_name("Bloodmoon Ursaluna ex")),
            "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_processed_name("Bloodmoon Ursaluna ex"))),
            "supertype": "Pokémon",
            "subtypes": ['Basic', 'ex'],
            "rarity": "Promo",
            "hp": "260",
            "set_id": "svp",
            "set_code": "SVP",
            "regulation_mark": "H",
            "set_name": "Scarlet & Violet Black Star Promos",
            "number": "177",
            "concatenated_attack_names": "Blood Moon", # used to match the card to the very similar looking regular set version
            "set_printed_total": 177, # The total printed on the card - excludes secret rares
            "small_image_url": "https://tcgplayer-cdn.tcgplayer.com/product/595473_in_1000x1000.jpg",
            "types": ['Colorless'],
            "national_pokedex_numbers": [901]
        },
        {
            "id": 'svp-181',
            "name": "N's Darmanitan",
            "name_without_prefix": re.sub(prefix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("N's Darmanitan"), "Pokémon")),
            "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("N's Darmanitan"), "Pokémon"))),
            "supertype": "Pokémon",
            "subtypes": ['Stage 1'],
            "rarity": "Promo",
            "hp": "140",
            "set_id": "svp",
            "set_code": "SVP",
            "regulation_mark": "I",
            "set_name": "Scarlet & Violet Black Star Promos",
            "number": "181",
            "set_printed_total": 181,
            "small_image_url": "https://pkmncards.com/wp-content/uploads/svbsp_en_181_std.jpg",
            "types": ['Fire'],
            "national_pokedex_numbers": [555]
        },
        {
            "id": 'svp-182',
            "name": "Iono's Kilowattrel",
            "name_without_prefix": re.sub(prefix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Iono's Kilowattrel"), "Pokémon")),
            "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Iono's Kilowattrel"), "Pokémon"))),
            "supertype": "Pokémon",
            "subtypes": ['Stage 1'],
            "rarity": "Promo",
            "hp": "120",
            "set_id": "svp",
            "set_code": "SVP",
            "regulation_mark": "I",
            "set_name": "Scarlet & Violet Black Star Promos",
            "number": "182",
            "set_printed_total": 182,
            "small_image_url": "https://pkmncards.com/wp-content/uploads/svbsp_en_182_std.jpg",
            "types": ['Lightning'],
            "national_pokedex_numbers": [941]
        },
        {
            "id": 'svp-183',
            "name": "Lillie's Ribombee",
            "name_without_prefix": re.sub(prefix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Lillie's Ribombee"), "Pokémon")),
            "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Lillie's Ribombee"), "Pokémon"))),
            "supertype": "Pokémon",
            "subtypes": ['Stage 1'],
            "rarity": "Promo",
            "hp": "70",
            "set_id": "svp",
            "set_code": "SVP",
            "regulation_mark": "I",
            "set_name": "Scarlet & Violet Black Star Promos",
            "number": "183",
            "set_printed_total": 183,
            "small_image_url": "https://pkmncards.com/wp-content/uploads/svbsp_en_183_std.jpg",
            "types": ['Psychic'],
            "national_pokedex_numbers": [743]
        },
        {
            "id": 'svp-184',
            "name": "Hop's Snorlax",
            "name_without_prefix": re.sub(prefix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Hop's Snorlax"), "Pokémon")),
            "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Hop's Snorlax"), "Pokémon"))),
            "supertype": "Pokémon",
            "subtypes": ['Basic'],
            "rarity": "Promo",
            "hp": "150",
            "set_id": "svp",
            "set_code": "SVP",
            "regulation_mark": "I",
            "set_name": "Scarlet & Violet Black Star Promos",
            "number": "184",
            "set_printed_total": 184,
            "small_image_url": "https://pkmncards.com/wp-content/uploads/svbsp_en_184_std.jpg",
            "types": ['Colorless'],
            "national_pokedex_numbers": [143]
        },
        {
            "id": 'svp-196',
            "name": "Charizard ex",
            "name_without_prefix": re.sub(prefix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Charizard ex"), "Pokémon")),
            "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Charizard ex"), "Pokémon"))),
            "supertype": "Pokémon",
            "subtypes": ['Stage 2', 'ex'],
            "rarity": "Promo",
            "hp": "330",
            "set_id": "svp",
            "set_code": "SVP",
            "regulation_mark": "I",
            "set_name": "Scarlet & Violet Black Star Promos",
            "number": "196",
            "set_printed_total": 196,
            "concatenated_attack_names": "Burning Darkness", # used to match the card to the very similar looking regular set version
            "small_image_url": "https://pkmncards.com/wp-content/uploads/svbsp_en_196_std.jpg",
            "types": ['Darkness'],
            "national_pokedex_numbers": [6]
        },
        {
            "id": 'svp-193',
            "name": "Hop's Zacian ex",
            "name_without_prefix": re.sub(prefix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Hop's Zacian ex"), "Pokémon")),
            "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Hop's Zacian ex"), "Pokémon"))),
            "supertype": "Pokémon",
            "subtypes": ['Basic', 'ex'],
            "rarity": "Promo",
            "hp": "230",
            "set_id": "svp",
            "set_code": "SVP",
            "regulation_mark": "I",
            "set_name": "Scarlet & Violet Black Star Promos",
            "number": "193",
            "concatenated_attack_names": "Insta Strike_Brave Slash", # used to match the card to the very similar looking regular set version
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
            "subtypes": ['Stage 1', 'ex'],
            "rarity": "Promo",
            "hp": "280",
            "set_id": "svp",
            "set_code": "SVP",
            "regulation_mark": "I",
            "set_name": "Scarlet & Violet Black Star Promos",
            "number": "194",
            "concatenated_attack_names": "Thunderous Bolt", # used to match the card to the very similar looking regular set version
            "set_printed_total": 194, # The total printed on the card - excludes secret rares
            "small_image_url": "https://pkmncards.com/wp-content/uploads/svbsp_en_194_std.jpg",
            "types": ['Electric'],
            "national_pokedex_numbers": [939]
        },
        {
            "id": 'svp-195',
            "name": "Lillie's Clefairy ex",
            "name_without_prefix": re.sub(prefix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Lillie's Clefairy ex"), "Pokémon")),
            "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Lillie's Clefairy ex"), "Pokémon"))),
            "supertype": "Pokémon",
            "subtypes": ['Basic', 'ex'],
            "rarity": "Promo",
            "hp": "190",
            "set_id": "svp",
            "set_code": "SVP",
            "regulation_mark": "I",
            "set_name": "Scarlet & Violet Black Star Promos",
            "number": "195",
            "concatenated_attack_names": "Full Moon Rondo", # used to match the card to the very similar looking regular set version
            "set_printed_total": 195, # The total printed on the card - excludes secret rares
            "small_image_url": "https://pkmncards.com/wp-content/uploads/svbsp_en_195_std.jpg",
            "types": ['Psychic'],
            "national_pokedex_numbers": [35]
        },
        {
            "id": 'svp-189',
            "name": "N's Zorua",
            "name_without_prefix": re.sub(prefix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("N's Zorua"), "Pokémon")),
            "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("N's Zorua"), "Pokémon"))),
            "supertype": "Pokémon",
            "subtypes": ['Basic'],
            "rarity": "Promo",
            "hp": "70",
            "set_id": "svp",
            "set_code": "SVP",
            "regulation_mark": "I",
            "set_name": "Scarlet & Violet Black Star Promos",
            "number": "189",
            "set_printed_total": 189, # The total printed on the card - excludes secret rares
            "small_image_url": "https://pkmncards.com/wp-content/uploads/svbsp_en_189_std.jpg",
            "types": ['Darkness'],
            "national_pokedex_numbers": [570]
        },
        {
            "id": 'svp-174',
            "name": "Eevee ex",
            "name_without_prefix": re.sub(prefix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Eevee ex"), "Pokémon")),
            "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Eevee ex"), "Pokémon"))),
            "supertype": "Pokémon",
            "subtypes": ['Basic', 'Tera', 'ex'],
            "rarity": "Promo",
            "hp": "200",
            "set_id": "svp",
            "set_code": "SVP",
            "regulation_mark": "H",
            "set_name": "Scarlet & Violet Black Star Promos",
            "number": "174",
            "set_printed_total": 174, # The total printed on the card - excludes secret rares
            "small_image_url": "https://tcgplayer-cdn.tcgplayer.com/product/632083_in_1000x1000.jpg",
            "types": ['Colorless'],
            "national_pokedex_numbers": [133]
        },
        {
            "id": 'svp-198',
            "name": "Zacian ex",
            "name_without_prefix": re.sub(prefix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Zacian ex"), "Pokémon")),
            "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Zacian ex"), "Pokémon"))),
            "supertype": "Pokémon",
            "subtypes": ['Basic', 'ex'],
            "rarity": "Promo",
            "hp": "220",
            "set_id": "svp",
            "set_code": "SVP",
            "regulation_mark": "H",
            "set_name": "Scarlet & Violet Black Star Promos",
            "number": "198",
            "set_printed_total": 198, # The total printed on the card - excludes secret rares
            "small_image_url": "https://archives.bulbagarden.net/media/upload/thumb/3/34/ZacianexSVPPromo198.jpg/270px-ZacianexSVPPromo198.jpg",
            "types": ['Metal'],
            "national_pokedex_numbers": [888]
        },
        {
            "id": 'svp-203',
            "name": "Team Rocket's Wobbuffet",
            "name_without_prefix": re.sub(prefix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Team Rocket's Wobbuffet"), "Pokémon")),
            "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Team Rocket's Wobbuffet"), "Pokémon"))),
            "supertype": "Pokémon",
            "subtypes": ['Basic'],
            "rarity": "Promo",
            "hp": "110",
            "set_id": "svp",
            "set_code": "SVP",
            "regulation_mark": "I",
            "set_name": "Scarlet & Violet Black Star Promos",
            "number": "203",
            "set_printed_total": 203, # The total printed on the card - excludes secret rares
            "small_image_url": "https://bulbapedia.bulbagarden.net/wiki/File:TeamRocketWobbuffetSVPPromo203.jpg",
            "types": ['Psychic'],
            "national_pokedex_numbers": [202]
        },
        {
            "id": 'svp-204',
            "name": "Cynthia's Garchomp ex",
            "name_without_prefix": re.sub(prefix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Cynthia's Garchomp ex"), "Pokémon")),
            "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Cynthia's Garchomp ex"), "Pokémon"))),
            "supertype": "Pokémon",
            "subtypes": ['Stage 2', 'ex'],
            "rarity": "Promo",
            "hp": "330",
            "set_id": "svp",
            "set_code": "SVP",
            "regulation_mark": "I",
            "set_name": "Scarlet & Violet Black Star Promos",
            "number": "204",
            "concatenated_attack_names": "Corkscrew Dive_Draconic Buster", # used to match the card to the very similar looking regular set version
            "set_printed_total": 204, # The total printed on the card - excludes secret rares
            "small_image_url": "https://www.cardtrader.com/uploads/blueprints/image/327135/show_cynthia-s-garchomp-204-sv-p-sv-black-star-promos(2).jpg",
            "types": ['Fighting'],
            "national_pokedex_numbers": [445]
        },
        {
            "id": 'svp-205',
            "name": "Team Rocket's Mewtwo ex",
            "name_without_prefix": re.sub(prefix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Team Rocket's Mewtwo ex"), "Pokémon")),
            "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Team Rocket's Mewtwo ex"), "Pokémon"))),
            "supertype": "Pokémon",
            "subtypes": ['Basic', 'ex'],
            "rarity": "Promo",
            "hp": "280",
            "set_id": "svp",
            "set_code": "SVP",
            "regulation_mark": "I",
            "set_name": "Scarlet & Violet Black Star Promos",
            "number": "205",
            "concatenated_attack_names": "Erasure Ball", # used to match the card to the very similar looking regular set version
            "set_printed_total": 205, # The total printed on the card - excludes secret rares
            "small_image_url": "https://www.pokemon.com/static-assets/content-assets/cms2/img/cards/web/SVP/SVP_EN_205.png",
            "types": ['Psychic'],
            "national_pokedex_numbers": [150]
        },
        {
            "id": 'svp-206',
            "name": "Marnie's Morpeko",
            "name_without_prefix": re.sub(prefix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Marnie's Morpeko"), "Pokémon")),
            "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Marnie's Morpeko"), "Pokémon"))),
            "supertype": "Pokémon",
            "subtypes": ['Basic'],
            "rarity": "Promo",
            "hp": "70",
            "set_id": "svp",
            "set_code": "SVP",
            "regulation_mark": "I",
            "set_name": "Scarlet & Violet Black Star Promos",
            "number": "206",
            "set_printed_total": 206,
            "small_image_url": "https://pkmncards.com/wp-content/uploads/svbsp_en_206_std.jpg",
            "types": ['Darkness'],
            "national_pokedex_numbers": [877]
        },
        {
            "id": 'svp-207',
            "name": "Steven's Beldum",
            "name_without_prefix": re.sub(prefix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Steven's Beldum"), "Pokémon")),
            "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Steven's Beldum"), "Pokémon"))),
            "supertype": "Pokémon",
            "subtypes": ['Basic'],
            "rarity": "Promo",
            "hp": "70",
            "set_id": "svp",
            "set_code": "SVP",
            "regulation_mark": "I",
            "set_name": "Scarlet & Violet Black Star Promos",
            "number": "207",
            "set_printed_total": 207,
            "small_image_url": "https://pkmncards.com/wp-content/uploads/svbsp_en_207_std.jpg",
            "types": ['Metal'],
            "national_pokedex_numbers": [374]
        },
        {
            "id": 'svp-216',
            "name": "Team Rocket's Mewtwo ex",
            "name_without_prefix": re.sub(prefix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Team Rocket's Mewtwo ex"), "Pokémon")),
            "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Team Rocket's Mewtwo ex"), "Pokémon"))),
            "supertype": "Pokémon",
            "subtypes": ['Basic', 'ex'],
            "rarity": "Promo",
            "hp": "280",
            "set_id": "svp",
            "set_code": "SVP",
            "regulation_mark": "I",
            "set_name": "Scarlet & Violet Black Star Promos",
            "number": "216",
            "concatenated_attack_names": "Erasure Ball", # used to match the card to the very similar looking regular set version
            "set_printed_total": 216, # The total printed on the card - excludes secret rares
            "small_image_url": "https://www.pokemon.com/static-assets/content-assets/cms2/img/cards/web/SVP/SVP_EN_216.png",
            "types": ['Psychic'],
            "national_pokedex_numbers": [150]
        },
        {
            "id": 'mep-1',
            "name": "Meganium",
            "name_without_prefix": re.sub(prefix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Meganium"), "Pokémon")),
            "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Meganium"), "Pokémon"))),
            "supertype": "Pokémon",
            "subtypes": ['Stage 2',],
            "rarity": "Promo",
            "hp": "160",
            "set_id": "mep",
            "set_code": "MEP",
            "regulation_mark": "I",
            "set_name": "Mega Evolution Black Star Promos",
            "number": "1",
            "set_printed_total": 1, # The total printed on the card - excludes secret rares
            "small_image_url": "https://www.pokemon.com/static-assets/content-assets/cms2/img/trading-card-game/series/incrementals/2025/me01-build-battle-box/inline/web/MEP_EN_1.png",
            "types": ['Grass'],
            "national_pokedex_numbers": [154]
        },
        {
            "id": 'mep-2',
            "name": "Inteleon",
            "name_without_prefix": re.sub(prefix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Inteleon"), "Pokémon")),
            "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Inteleon"), "Pokémon"))),
            "supertype": "Pokémon",
            "subtypes": ['Stage 2',],
            "rarity": "Promo",
            "hp": "150",
            "set_id": "mep",
            "set_code": "MEP",
            "regulation_mark": "I",
            "set_name": "Mega Evolution Black Star Promos",
            "number": "2",
            "set_printed_total": 2, # The total printed on the card - excludes secret rares
            "small_image_url": "https://www.pokemon.com/static-assets/content-assets/cms2/img/trading-card-game/series/incrementals/2025/me01-build-battle-box/inline/web/MEP_EN_2.png",
            "types": ['Water'],
            "national_pokedex_numbers": [818]
        },
        {
            "id": 'mep-3',
            "name": "Alakazam",
            "name_without_prefix": re.sub(prefix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Alakazam"), "Pokémon")),
            "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Alakazam"), "Pokémon"))),
            "supertype": "Pokémon",
            "subtypes": ['Stage 2',],
            "rarity": "Promo",
            "hp": "140",
            "set_id": "mep",
            "set_code": "MEP",
            "regulation_mark": "I",
            "set_name": "Mega Evolution Black Star Promos",
            "number": "3",
            "set_printed_total": 3, # The total printed on the card - excludes secret rares
            "small_image_url": "https://www.pokemon.com/static-assets/content-assets/cms2/img/trading-card-game/series/incrementals/2025/me01-build-battle-box/inline/web/MEP_EN_3.png",
            "types": ['Psychic'],
            "national_pokedex_numbers": [65]
        },
        {
            "id": 'mep-4',
            "name": "Lunatone",
            "name_without_prefix": re.sub(prefix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Lunatone"), "Pokémon")),
            "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Lunatone"), "Pokémon"))),
            "supertype": "Pokémon",
            "subtypes": ['Basic',],
            "rarity": "Promo",
            "hp": "110",
            "set_id": "mep",
            "set_code": "MEP",
            "regulation_mark": "I",
            "set_name": "Mega Evolution Black Star Promos",
            "number": "4",
            "set_printed_total": 4, # The total printed on the card - excludes secret rares
            "small_image_url": "https://www.pokemon.com/static-assets/content-assets/cms2/img/trading-card-game/series/incrementals/2025/me01-build-battle-box/inline/web/MEP_EN_4.png",
            "types": ['Fighting'],
            "national_pokedex_numbers": [337]
        },
        {
            "id": 'mep-7',
            "name": "Psyduck",
            "name_without_prefix": re.sub(prefix_replacement_regex, '', get_processed_name("Psyduck")),
            "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_processed_name("Psyduck"))),
            "supertype": "Pokémon",
            "subtypes": ['Basic',],
            "rarity": "Promo",
            "hp": "70",
            "set_id": "mep",
            "set_code": "MEP",
            "regulation_mark": "I",
            "set_name": "Mega Evolution Black Star Promos",
            "number": "7",
            "set_printed_total": 7, # The total printed on the card - excludes secret rares
            "small_image_url": "https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/MEP/MEP_007_R_EN_LG.png",
            "types": ['Water'],
            "national_pokedex_numbers": [54]
        },
        {
            "id": 'mep-8',
            "name": "Golduck",
            "name_without_prefix": re.sub(prefix_replacement_regex, '', get_processed_name("Golduck")),
            "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_processed_name("Golduck"))),
            "supertype": "Pokémon",
            "subtypes": ['Stage 1',],
            "rarity": "Promo",
            "hp": "120",
            "set_id": "mep",
            "set_code": "MEP",
            "regulation_mark": "I",
            "set_name": "Mega Evolution Black Star Promos",
            "number": "8",
            "set_printed_total": 8, # The total printed on the card - excludes secret rares
            "small_image_url": "https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/MEP/MEP_008_R_EN_LG.png",
            "types": ['Water'],
            "national_pokedex_numbers": [55]
        },
        {
            "id": 'mep-9',
            "name": "Alakazam",
            "name_without_prefix": re.sub(prefix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Alakazam"), "Pokémon")),
            "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Alakazam"), "Pokémon"))),
            "supertype": "Pokémon",
            "subtypes": ['Stage 2',],
            "rarity": "Promo",
            "hp": "140",
            "set_id": "mep",
            "set_code": "MEP",
            "regulation_mark": "I",
            "set_name": "Mega Evolution Black Star Promos",
            "number": "9",
            "set_printed_total": 9, # The total printed on the card - excludes secret rares
            "small_image_url": "https://archives.bulbagarden.net/media/upload/thumb/0/09/AlakazamMEPPromo9.jpg/270px-AlakazamMEPPromo9.jpg",
            "types": ['Psychic'],
            "national_pokedex_numbers": [65]
        },
        {
            "id": 'mep-10',
            "name": "Riolu",
            "name_without_prefix": re.sub(prefix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Riolu"), "Pokémon")),
            "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Riolu"), "Pokémon"))),
            "supertype": "Pokémon",
            "subtypes": ['Basic',],
            "rarity": "Promo",
            "hp": "80",
            "set_id": "mep",
            "set_code": "MEP",
            "regulation_mark": "I",
            "set_name": "Mega Evolution Black Star Promos",
            "number": "10",
            "set_printed_total": 10, # The total printed on the card - excludes secret rares
            "small_image_url": "https://archives.bulbagarden.net/media/upload/thumb/8/83/RioluMEPPromo10.jpg/270px-RioluMEPPromo10.jpg",
            "types": ['Fighting'],
            "national_pokedex_numbers": [447]
        },
        {
            "id": 'mep-11',
            "name": "Mega Latias ex",
            "name_without_prefix": re.sub(prefix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Mega Latias ex"), "Pokémon")),
            "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Mega Latias ex"), "Pokémon"))),
            "supertype": "Pokémon",
            "subtypes": ['Basic', 'ex'],
            "rarity": "Promo",
            "hp": "280",
            "set_id": "mep",
            "set_code": "MEP",
            "regulation_mark": "I",
            "set_name": "Mega Evolution Black Star Promos",
            "number": "11",
            "concatenated_attack_names": "Strafe_Illusory Impulse", # used to match the card to the very similar looking regular set version
            "set_printed_total": 11, # The total printed on the card - excludes secret rares
            "small_image_url": "https://tcgplayer-cdn.tcgplayer.com/product/657846_in_1000x1000.jpg",
            "types": ['Dragon'],
            "national_pokedex_numbers": [380]
        },
        {
            "id": 'mep-12',
            "name": "Mega Lucario ex",
            "name_without_prefix": re.sub(prefix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Mega Lucario ex"), "Pokémon")),
            "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Mega Lucario ex"), "Pokémon"))),
            "supertype": "Pokémon",
            "subtypes": ['Stage 1', 'ex'],
            "rarity": "Promo",
            "hp": "340",
            "set_id": "mep",
            "set_code": "MEP",
            "regulation_mark": "I",
            "set_name": "Mega Evolution Black Star Promos",
            "number": "12",
            "concatenated_attack_names": "Aura Jab_Mega Brave", # used to match the card to the very similar looking regular set version
            "set_printed_total": 12, # The total printed on the card - excludes secret rares
            "small_image_url": "https://tcgplayer-cdn.tcgplayer.com/product/663177_in_1000x1000.jpg",
            "types": ['Fighting'],
            "national_pokedex_numbers": [448]
        },
        {
            "id": 'mep-13',
            "name": "Mega Venusaur ex",
            "name_without_prefix": re.sub(prefix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Mega Venusaur ex"), "Pokémon")),
            "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Mega Venusaur ex"), "Pokémon"))),
            "supertype": "Pokémon",
            "subtypes": ['Stage 2', 'ex'],
            "rarity": "Promo",
            "hp": "380",
            "set_id": "mep",
            "set_code": "MEP",
            "regulation_mark": "I",
            "set_name": "Mega Evolution Black Star Promos",
            "number": "13",
            "concatenated_attack_names": "Jungle Dump", # used to match the card to the very similar looking regular set version
            "set_printed_total": 13,
            "small_image_url": "https://assets.pokemon.com/static-assets/content-assets/cms2/img/cards/web/MEP/MEP_EN_13.png",
            "types": ['Grass'],
            "national_pokedex_numbers": [3]
        },
        {
            "id": 'mep-14',
            "name": "Ceruledge",
            "name_without_prefix": re.sub(prefix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Ceruledge"), "Pokémon")),
            "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Ceruledge"), "Pokémon"))),
            "supertype": "Pokémon",
            "subtypes": ['Stage 1'],
            "rarity": "Promo",
            "hp": "140",
            "set_id": "mep",
            "set_code": "MEP",
            "regulation_mark": "I",
            "set_name": "Mega Evolution Black Star Promos",
            "number": "14",
            "set_printed_total": 27, # The total printed on the card - excludes secret rares
            "small_image_url": "https://pkmncards.com/wp-content/uploads/mebsp_en_014_std.jpg",
            "types": ['Fire'],
            "national_pokedex_numbers": [937]
        },
        {
            "id": 'mep-15',
            "name": "Zacian",
            "name_without_prefix": re.sub(prefix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Zacian"), "Pokémon")),
            "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Zacian"), "Pokémon"))),
            "supertype": "Pokémon",
            "subtypes": ['Basic'],
            "rarity": "Promo",
            "hp": "130",
            "set_id": "mep",
            "set_code": "MEP",
            "regulation_mark": "I",
            "set_name": "Mega Evolution Black Star Promos",
            "number": "15",
            "set_printed_total": 27,
            "small_image_url": "https://pkmncards.com/wp-content/uploads/mebsp_en_015_std.jpg",
            "types": ['Metal'],
            "national_pokedex_numbers": [888]
        },
        {
            "id": 'mep-16',
            "name": "Flygon",
            "name_without_prefix": re.sub(prefix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Flygon"), "Pokémon")),
            "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Flygon"), "Pokémon"))),
            "supertype": "Pokémon",
            "subtypes": ['Stage 2'],
            "rarity": "Promo",
            "hp": "150",
            "set_id": "mep",
            "set_code": "MEP",
            "regulation_mark": "I",
            "set_name": "Mega Evolution Black Star Promos",
            "number": "16",
            "set_printed_total": 27,
            "small_image_url": "https://pkmncards.com/wp-content/uploads/mebsp_en_016_std.jpg",
            "types": ['Dragon'],
            "national_pokedex_numbers": [330]
        },
        {
            "id": 'mep-17',
            "name": "Toxtricity",
            "name_without_prefix": re.sub(prefix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Toxtricity"), "Pokémon")),
            "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Toxtricity"), "Pokémon"))),
            "supertype": "Pokémon",
            "subtypes": ['Stage 1'],
            "rarity": "Promo",
            "hp": "140",
            "set_id": "mep",
            "set_code": "MEP",
            "regulation_mark": "I",
            "set_name": "Mega Evolution Black Star Promos",
            "number": "17",
            "set_printed_total": 27,
            "small_image_url": "https://pkmncards.com/wp-content/uploads/mebsp_en_017_std.jpg",
            "types": ['Electric'],
            "national_pokedex_numbers": [849]
        },
        {
            "id": 'mep-22',
            "name": "Charcadet",
            "name_without_prefix": re.sub(prefix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Charcadet"), "Pokémon")),
            "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Charcadet"), "Pokémon"))),
            "supertype": "Pokémon",
            "subtypes": ['Basic'],
            "rarity": "Promo",
            "hp": "70",
            "set_id": "mep",
            "set_code": "MEP",
            "regulation_mark": "I",
            "set_name": "Mega Evolution Black Star Promos",
            "number": "22",
            "set_printed_total": 27,
            "small_image_url": "https://pkmncards.com/wp-content/uploads/mebsp_en_022_std.jpg",
            "types": ['Fire'],
            "national_pokedex_numbers": [935]
        },
        {
            "id": 'mep-23',
            "name": "Mega Charizard X ex",
            "name_without_prefix": re.sub(prefix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Mega Charizard X ex"), "Pokémon")),
            "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Mega Charizard X ex"), "Pokémon"))),
            "supertype": "Pokémon",
            "subtypes": ['Stage 2', 'ex'],
            "rarity": "Promo",
            "hp": "360",
            "set_id": "mep",
            "set_code": "MEP",
            "regulation_mark": "I",
            "set_name": "Mega Evolution Black Star Promos",
            "number": "23",
            "set_printed_total": 27,
            "small_image_url": "https://pkmncards.com/wp-content/uploads/mebsp_en_023_std.jpg",
            "types": ['Fire'],
            "national_pokedex_numbers": [6]
        },
        {
            "id": 'mep-24',
            "name": "Oricorio ex",
            "name_without_prefix": re.sub(prefix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Oricorio ex"), "Pokémon")),
            "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Oricorio ex"), "Pokémon"))),
            "supertype": "Pokémon",
            "subtypes": ['Basic', 'ex'],
            "rarity": "Promo",
            "hp": "190",
            "set_id": "mep",
            "set_code": "MEP",
            "regulation_mark": "I",
            "set_name": "Mega Evolution Black Star Promos",
            "number": "24",
            "set_printed_total": 27,
            "small_image_url": "https://pkmncards.com/wp-content/uploads/mebsp_en_024_std.jpg",
            "types": ['Fire'],
            "national_pokedex_numbers": [741]
        },
        {
            "id": 'mep-25',
            "name": "Mega Kangaskhan ex",
            "name_without_prefix": re.sub(prefix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Mega Kangaskhan ex"), "Pokémon")),
            "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Mega Kangaskhan ex"), "Pokémon"))),
            "supertype": "Pokémon",
            "subtypes": ['Basic', 'ex'],
            "rarity": "Promo",
            "hp": "300",
            "set_id": "mep",
            "set_code": "MEP",
            "regulation_mark": "I",
            "set_name": "Mega Evolution Black Star Promos",
            "number": "25",
            "concatenated_attack_names": "Rapid-Fire Combo", # used to match the card to the very similar looking regular set version
            "set_printed_total": 27,
            "small_image_url": "https://pkmncards.com/wp-content/uploads/mebsp_en_025_std.jpg",  
            "types": ['Colorless'],
            "national_pokedex_numbers": [115]
        },
        {
            "id": 'mep-26',
            "name": "Meloetta",
            "name_without_prefix": re.sub(prefix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Meloetta"), "Pokémon")),
            "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Meloetta"), "Pokémon"))),
            "supertype": "Pokémon",
            "subtypes": ['Basic'],
            "rarity": "Promo",
            "hp": "90",
            "set_id": "mep",
            "set_code": "MEP",
            "regulation_mark": "I",
            "set_name": "Mega Evolution Black Star Promos",
            "number": "26",
            "set_printed_total": 27,
            "small_image_url": "https://pkmncards.com/wp-content/uploads/mebsp_en_026_std.jpg",  
            "types": ['Psychic'],
            "national_pokedex_numbers": [648]
        },
        {
            "id": 'mep-27',
            "name": "Haunter",
            "name_without_prefix": re.sub(prefix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Haunter"), "Pokémon")),
            "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_maybe_trainer_removed_name(get_processed_name("Haunter"), "Pokémon"))),
            "supertype": "Pokémon",
            "subtypes": ['Stage 1'],
            "rarity": "Promo",
            "hp": "100",
            "set_id": "mep",
            "set_code": "MEP",
            "regulation_mark": "I",
            "set_name": "Mega Evolution Black Star Promos",
            "number": "27",
            "set_printed_total": 27,
            "small_image_url": "https://pkmncards.com/wp-content/uploads/mebsp_en_027_std.jpg",  
            "types": ['Darkness'],
            "national_pokedex_numbers": [93]
        },
        # {
        #     "id": '???',
        #     "name": "???",
        #     "name_without_prefix": re.sub(prefix_replacement_regex, '', get_processed_name("???"), "Pokémon"),
        #     "name_without_prefix_and_postfix": re.sub(prefix_replacement_regex, '', re.sub(postfix_replacement_regex, '', get_processed_name("???"), "Pokémon")),
        #     "supertype": "Pokémon",
        #     "hp": "???",
        #     "set_id": "mep",
        #     "set_code": "MEP",
        #     "regulation_mark": "???",
        #     "set_name": "Mega Evolution Black Star Promos",
        #     "number": "???"",
        #     "set_printed_total": ???, # The total printed on the card - excludes secret rares
        #     "small_image_url": "???",
        #     "types": ['???'],
        #     "national_pokedex_numbers": [???]
        # }
    ])
    # Add in rarity_for_mismatch_correction to manual fixes
    manual_fixes_df = manual_fixes_df.assign(
        rarity_for_mismatch_correction = manual_fixes_df.apply(
            lambda row: get_rarity_for_mismatch_correction(row['id'], row['rarity']),
            axis=1
        )
    )
    dfs_list.append(manual_fixes_df)

    concatenated_df = pd.concat(dfs_list, ignore_index=True)

    # Sort the concatenated dataframe so all common, uncommons, and rares are at the beginning
    # Read the rarity from the 'rarity' column, and sort by that
    # This makes certain types of postprocessing easier
    rarity_order = {
        'Common': 1,
        'Uncommon': 2,
        'Rare': 3,
        'Rare Holo': 4,
    }
    concatenated_df['rarity_order'] = concatenated_df['rarity'].map(rarity_order).fillna(11)  # Fill unspecified rarities with a high number
    concatenated_df = concatenated_df.sort_values(by=['rarity_order'])

    print("Finished downloading info for " + str(concatenated_df.shape[0]) + " cards")
    return concatenated_df

def compute_detection_keywords_for_name(target_name, all_names):
    # Edge cases - to prevent false squawkabilly and scream tail detection
    special_cases = ["billy & o'nare", "jumbo ice cream"]
    if target_name.lower() in special_cases:
        return [target_name]
    
    # look at all possible prefixes and postfixes for target_name
    # for each of these that are not a substring present within all_names, add them to the result list

    result = []
    target_name = target_name.strip()
    words = target_name.split()
    n = len(words)

    # Remove exact matches to the target name
    filtered_names = [name.strip() for name in all_names if name.strip() != target_name]

    # Word-based prefixes
    for i in range(1, n + 1):
        prefix = ' '.join(words[:i])
        if not any(prefix in name for name in filtered_names) and len(prefix) > 4:
            result.append(prefix)

    # Word-based postfixes
    for i in range(n):
        postfix = ' '.join(words[i:])
        if not any(postfix in name for name in filtered_names) and len(postfix) > 4:
            result.append(postfix)
            
    # Remove the word 'stadium' from the result if present, to prevent false positives
    result = [keyword for keyword in result if keyword.lower() != 'stadium']

    return result

def add_detection_keywords_to_df(cards_df):
    # function that adds a column to the df to help speed up detection
    all_names = cards_df['name'].to_list()
    cards_df = cards_df.assign(
        detection_keywords = cards_df['name'].apply(
            lambda x: compute_detection_keywords_for_name(x, cards_df['name'].tolist())
    ))
    return cards_df

def get_rarity_for_mismatch_correction(card_id, rarity):
    # TODO: Implement
    if rarity != 'Promo':
        return rarity # if not a promo, return the original rarity
    
    # If it's a promo, try to match it to an existing rarity so we can tell the user if
    # they might be mis-scanning a card
     
    # Cards that look like double rares, but are promos
    if card_id in [
        "svp-28",
        "svp-29",
        "svp-33",
        "svp-34",
        "svp-25",
        "svp-49",
        "svp-50",
        "svp-67",
        "svp-68",
        "svp-126",
        "svp-127",
        "svp-128",
        "svp-144",
        "svp-145",
        "svp-146",
        "svp-147",
        "svp-160",
        "svp-161",
        "svp-177",
        "svp-193",
        "svp-196",
        "svp-205",
        "svp-216",
        "svp-217",
        "svp-218",
        "mep-11",
        "mep-12",
        "mep-25",
    ]:
        return 'Double Rare'
    
    # Cards that look like full arts, but are promos
    if card_id in [
        "svp-56",
        "svp-74",
        "svp-166",
        "svp-194",
        "svp-195",
        "svp-204",
    ]:
        return 'Ultra Rare'
    
      # Cards that look like commons, but are promos
    if card_id in [
        # "mep-7", # Psyduck
    ]:
        return 'Common'
    
    # TODO: Add in golduck from ASC, depending on rarity
   
    return rarity


def add_similar_card_ids_to_df(cards_df):
    # function that adds a column to the df to help tell the user if they might be mis-scanning a card
    
    # TODO: deal with promo 'psuedo' rarities
    
    # group together cards with the same name, rarity, and concatenated_attack_names
    # if these 3 match, the cards are very likely to look like one another
    cards_df = cards_df.assign(
        similar_card_ids = cards_df.apply(
            lambda row: cards_df[
                (row['concatenated_attack_names'] is not None) &
                (cards_df['concatenated_attack_names'] == row['concatenated_attack_names']) &
                (cards_df['name'] == row['name']) &                
                (cards_df['rarity_for_mismatch_correction'] == row['rarity_for_mismatch_correction']) & 
                (cards_df['id'] != row['id'])
            ]['id'].tolist(),
            axis=1
        )
    )
    return cards_df


def download_missing_card_images_and_sprites_for_df(cards_df):
    print("Downloading image data")
    # Downloads images of cards for which the image does not already exist in CARD_IMAGES_DIRECTORY
    # Naturally, this function will download all the images if none of them exist
    for index, card in cards_df.iterrows():
        file_name = card["id"] + ".png"
        img_path = CARD_IMAGES_DIRECTORY + "/" + file_name
        if not os.path.isfile(img_path):
            print("#" + str(index + 1) + ": Downloading " + card["small_image_url"] + " to " + img_path)
            urllib.request.urlretrieve(card["small_image_url"], img_path)
        # else:
        #     print("#" + str(index + 1) + ": " + img_path + " already exists; skipping download")
        shutil.copy(img_path, CLIENT_CARD_IMAGES_DIRECTORY + "/" + file_name)

        if card["supertype"] == 'Pokémon':
            name_without_prefix_and_postfix = card["name_without_prefix_and_postfix"]
            sprite_file_name = re.sub(sprite_url_replacement_regex, '', name_without_prefix_and_postfix.lower().replace(" ", "-").replace("'", "").replace("é", "e").replace("-♀", "-f").replace("-♂", "-m").replace("♀", "-f").replace("♂", "-m")) + ".png"
            sprite_path = SPRITES_DIRECTORY + '/' + sprite_file_name
            sprite_url = 'https://r2.limitlesstcg.net/pokemon/gen9/' + sprite_file_name
            if not os.path.isfile(sprite_path):
                print("#" + str(index + 1) + ": Downloading " + sprite_url + " to " + sprite_path)
                urllib.request.urlretrieve(sprite_url, sprite_path)
            # else:
            #     print("#" + str(index + 1) + ": " + sprite_path + " already exists; skipping download")
            shutil.copy(sprite_path, CLIENT_SPRITES_DIRECTORY + "/" + sprite_file_name)

        if card["supertype"] == 'Energy' and card['name'] not in BASIC_ENERGY_NAMES and convert_int_or_infinity(card['number']) <= card['set_printed_total']:
            energy_symbol_file_name = re.sub(' ', '-', card['name']).lower()
            energy_symbol_file_name = re.sub(sprite_url_replacement_regex, '', energy_symbol_file_name) + ".png"
            energy_symbol_path = CLIENT_SPECIAL_ENERGY_SYMBOLS_DIRECTORY + "/" + energy_symbol_file_name
            img = Image.open(img_path)
            width, height = img.size
            left = width * 0.87
            upper = height * 0.07
            right = width * 0.96
            lower = height * 0.135
            cropped = img.crop((left, upper, right, lower)) 
            target_height = 32
            target_width = int(cropped.width * (target_height / cropped.height))
            cropped = cropped.resize((target_width, target_height), Image.LANCZOS)

            # Crop the image to a circle
            bigsize = (cropped.size[0] * 3, cropped.size[1] * 3)
            mask = Image.new('L', bigsize, 0)
            draw = ImageDraw.Draw(mask) 
            draw.ellipse((0, 0) + bigsize, fill=255)
            mask = mask.resize(cropped.size, Image.LANCZOS)
            cropped.putalpha(mask)

            cropped.save(energy_symbol_path)

        # Trainers for which we want to generate thumbnails
        # Only generate thumbnails for trainers which aren't secret rares
        # Unless they are supporters, in which case we want full arts where they are available
        # This is because the character's face from a full art often looks better in thumbnail
        # format as opposed to the upper body of the base rarity
        if card["supertype"] == 'Trainer' and (convert_int_or_infinity(card['number']) <= card['set_printed_total'] 
                                               or (card['rarity'] == 'Ultra Rare' and card['subtypes'] is not None and 'Supporter' in card['subtypes'])):
            trainer_symbol_file_name = re.sub(' ', '-', card['name']).lower()
            trainer_symbol_file_name = re.sub(sprite_url_replacement_regex, '', trainer_symbol_file_name) + ".png"
            trainer_symbol_path = CLIENT_TRAINER_SYMBOLS_DIRECTORY + "/" + trainer_symbol_file_name
            img = Image.open(img_path)
            width, height = img.size
            left = width * 0.075
            upper = height * 0.14
            right = width * 0.925
            lower = height * 0.52
            cropped = img.crop((left, upper, right, lower))
            target_height = 32
            target_width = int(cropped.width * (target_height / cropped.height))
            cropped = cropped.resize((target_width, target_height), Image.LANCZOS)

            # Crop the image to a rounded rectangle
            bigsize = (cropped.size[0] * 3, cropped.size[1] * 3)
            mask = Image.new('L', bigsize, 0)
            draw = ImageDraw.Draw(mask) 
            draw.rounded_rectangle(((0, 0), bigsize), bigsize[0] / 5, fill=255)

            mask = mask.resize(cropped.size, Image.LANCZOS)
            cropped.putalpha(mask)

            cropped.save(trainer_symbol_path)

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

    # cards_df.to_csv('data/temp_cards.csv')
    # cards_df = pd.read_csv('data/temp_cards.csv')

    cards_df = add_detection_keywords_to_df(cards_df)
    cards_df =  add_similar_card_ids_to_df(cards_df)
    
    # delete the 'concatenated_attack_names' and 'rarity_for_mismatch_correction' columns; we don't need these in the final output
    if 'concatenated_attack_names' in cards_df.columns:
        cards_df = cards_df.drop(columns=['concatenated_attack_names'])
        
    if 'rarity_for_mismatch_correction' in cards_df.columns:
        cards_df = cards_df.drop(columns=['rarity_for_mismatch_correction'])

    download_missing_card_images_and_sprites_for_df(cards_df)

    cards_dict = {}
    for i, card in cards_df.iterrows():
        cards_dict[card['id']] = card.to_dict()
    with open('../client/public/card_database.json', 'w') as f:
        json.dump(cards_dict, f)

    print("Done!")
