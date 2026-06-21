import pandas as pd
import urllib
import urllib.request
import urllib.parse
import os
import re
import shutil
import json
import math
import hashlib
import html
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


owner_replacement_regex = re.compile(r"^((N|Iono|Lillie|Hop|Marnie|Steven|Arven|Misty|Ethan|Cynthia|Team Rocket|Erika|Larry)'s )*", re.IGNORECASE)


def normalize_apostrophes_in_card_text(value):
    if value is None:
        return None
    return value.replace("’", "'")

# If the card is a pokemon, remove the owner name from the beginning
# Leave in owner names for trainers
# Note that the owner name is part of the card name for decklist purposes, so should not always be stripped out
def get_maybe_trainer_removed_name(name, supertype):
    name = normalize_apostrophes_in_card_text(name)
    return re.sub(owner_replacement_regex, '', name) if supertype == 'Pokémon' else name


# Does basic name processing, but does not remove prefix/postfixes that should be part of the core name
def get_processed_name(name):
    name = normalize_apostrophes_in_card_text(name)
    if professors_research_named_regex.match(name):
        return "Professor's Research"
    if boss_orders_named_regex.match(name):
        return "Boss's Orders"
    if basic_energy_regex.match(name):
        return re.sub(basic_energy_replacement_regex, "", name)
    return name


def get_card_mechanics_hash(card):
    # Hash the mechanics that determine game behavior so alternate arts can be swapped safely.
    attacks = card.get('attacks') or []
    abilities = card.get('abilities') or []
    weaknesses = card.get('weaknesses') or []
    resistances = card.get('resistances') or []
    retreat_cost = card.get('retreatCost') or []

    attack_names = sorted([
        attack.get('name')
        for attack in attacks
        if attack is not None and attack.get('name') is not None
    ])
    if len(attack_names) == 0 and card.get('concatenated_attack_names') is not None:
        attack_names = sorted([
            attack_name
            for attack_name in str(card.get('concatenated_attack_names')).split('_')
            if attack_name != ''
        ])

    ability_names = sorted([
        ability.get('name')
        for ability in abilities
        if ability is not None and ability.get('name') is not None
    ])

    weakness_values = sorted([
        f"{weakness.get('type')}|{weakness.get('value')}"
        for weakness in weaknesses
        if weakness is not None and weakness.get('type') is not None
    ])

    resistance_values = sorted([
        f"{resistance.get('type')}|{resistance.get('value')}"
        for resistance in resistances
        if resistance is not None and resistance.get('type') is not None
    ])

    payload = {
        "name": get_processed_name(card.get('name')),
        "hp": card.get('hp'),
        "ability_names": ability_names,
        "attack_names": attack_names,
        "retreat_cost": sorted([str(cost) for cost in retreat_cost if cost is not None]),
        "types": sorted([str(card_type) for card_type in (card.get('types') or []) if card_type is not None]),
        "weaknesses": weakness_values,
        "resistances": resistance_values,
        "regulation_mark": card.get('regulationMark') if card.get('regulationMark') is not None else card.get('regulation_mark'),
    }

    serialized = json.dumps(payload, sort_keys=True, separators=(',', ':'))
    return hashlib.sha1(serialized.encode('utf-8')).hexdigest()


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
  "me1": "MEG",
  "me2": "PFL",
  "me2pt5": "ASC",
  "me3": "POR",
  "me4": "CRI",
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


PROMO_SET_CONFIG = {
    "svp": {
        "set_code": "SVP",
        "set_name": "Scarlet & Violet Black Star Promos",
        "set_slug": "scarlet-violet-promos",
    },
    "mep": {
        "set_code": "MEP",
        "set_name": "Mega Evolution Black Star Promos",
        "set_slug": "mega-evolution-promos",
    },
}

PROMO_TYPE_SYMBOL_TO_NAME = {
    "G": "Grass",
    "R": "Fire",
    "W": "Water",
    "L": "Lightning",
    "P": "Psychic",
    "F": "Fighting",
    "D": "Darkness",
    "M": "Metal",
    "N": "Dragon",
    "Y": "Fairy",
    "C": "Colorless",
}

promo_species_number_cache = {}


def open_url(url):
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "script"}
    )
    return urllib.request.urlopen(request, timeout=20)


def fetch_text_url(url):
    with open_url(url) as response:
        return response.read().decode('utf-8')


def download_url_to_file(url, destination_path):
    with open_url(url) as response, open(destination_path, 'wb') as output_file:
        shutil.copyfileobj(response, output_file)


def try_download_url_to_file(url, destination_path):
    try:
        download_url_to_file(url, destination_path)
        return True
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return False
        raise


def search_first_regex_match(pattern, text, flags=0, default=None):
    match = re.search(pattern, text, flags)
    if match is None:
        return default
    if match.lastindex is None:
        return match.group(0)
    if match.lastindex == 1:
        return match.group(1)
    return match.groups()


def html_to_normalized_text(value):
    if value is None:
        return None
    value = re.sub(r'<br\s*/?>', '\n', value, flags=re.IGNORECASE)
    value = re.sub(r'<[^>]+>', '', value)
    value = html.unescape(value)
    return re.sub(r'\s+', ' ', value).strip()


def normalize_pokeapi_species_slug(slug):
    normalized_slug = slug.lower()
    normalized_slug = normalized_slug.replace("♀", "-f").replace("♂", "-m")
    normalized_slug = normalized_slug.replace("’", "").replace("'", "")
    return normalized_slug


def normalize_name_for_sprite_filename(value):
    return (
        value.lower()
        .replace("’", "")
        .replace("'", "")
        .replace(" ", "-")
        .replace("é", "e")
        .replace("-♀", "-f")
        .replace("-♂", "-m")
        .replace("♀", "-f")
        .replace("♂", "-m")
    )


def get_pokeapi_species_slug_candidates(species_slug):
    normalized_slug = normalize_pokeapi_species_slug(species_slug)
    candidates = [normalized_slug]

    generic_fallbacks = {
        "nidoran-female": "nidoran-f",
        "nidoran-male": "nidoran-m",
        "mr-mime": "mr-mime",
        "mime-jr": "mime-jr",
        "type-null": "type-null",
        "farfetchd": "farfetchd",
    }
    if normalized_slug in generic_fallbacks and generic_fallbacks[normalized_slug] not in candidates:
        candidates.append(generic_fallbacks[normalized_slug])

    return candidates


def get_national_pokedex_numbers_for_species_slug(species_slug):
    for candidate_slug in get_pokeapi_species_slug_candidates(species_slug):
        if candidate_slug in promo_species_number_cache:
            return promo_species_number_cache[candidate_slug]

        species_url = f"https://pokeapi.co/api/v2/pokemon-species/{urllib.parse.quote(candidate_slug)}/"
        try:
            species_data = json.load(open_url(species_url))
            promo_species_number_cache[candidate_slug] = [species_data['id']]
            return promo_species_number_cache[candidate_slug]
        except urllib.error.HTTPError as error:
            if error.code != 404:
                raise

    raise ValueError(f"Could not resolve PokeAPI species slug for {species_slug}")


def promo_set_printed_total_from_card_number(set_id, number):
    return int(number)


def parse_promo_retreat_cost(retreat_value):
    if retreat_value is None or retreat_value == '0':
        return []
    try:
        retreat_count = int(retreat_value)
    except ValueError:
        return []
    return ['Colorless'] * retreat_count


def parse_promo_card_page(card_html, set_id):
    config = PROMO_SET_CONFIG[set_id]

    title = search_first_regex_match(r'<h1 class="card-title"[^>]*>([^<]+)</h1>', card_html)
    if title is None:
        raise ValueError(f"Could not parse promo card title for set {set_id}")

    card_name_raw, card_number = search_first_regex_match(
        r'^(.*?) · .*?#(\d+)$',
        html_to_normalized_text(title)
    )

    supertype = html_to_normalized_text(search_first_regex_match(
        r'<span class="type"[^>]*>(.*?)</span>',
        card_html,
        flags=re.DOTALL
    ))

    hp = search_first_regex_match(
        r'<span class="hp"[^>]*>(?:<a [^>]*>)?(\d+)\s*HP(?:</a>)?</span>',
        card_html,
        flags=re.DOTALL
    )

    type_symbols = re.findall(
        r'<span class="color"[^>]*>.*?<abbr title="[^"]+" class="ptcg-font ptcg-symbol-name"><span class="vh">\{</span>([A-Z])',
        card_html,
        re.DOTALL
    )
    types = [PROMO_TYPE_SYMBOL_TO_NAME[symbol] for symbol in type_symbols if symbol in PROMO_TYPE_SYMBOL_TO_NAME]

    type_evolves_html = search_first_regex_match(
        r'<div class="type-evolves-is">(.*?)</div>',
        card_html,
        flags=re.DOTALL,
        default=''
    )
    stage = html_to_normalized_text(search_first_regex_match(r'<span class="stage"[^>]*>(.*?)</span>', type_evolves_html, flags=re.DOTALL))
    evolves_from = html_to_normalized_text(search_first_regex_match(
        r'<span class="evolves">Evolves from (.*?)</span>',
        type_evolves_html,
        flags=re.DOTALL
    ))
    trainer_subtype = html_to_normalized_text(search_first_regex_match(
        r'<span class="sub-type"[^>]*>(.*?)</span>',
        type_evolves_html,
        flags=re.DOTALL
    ))
    is_value = html_to_normalized_text(search_first_regex_match(
        r'<span class="is"[^>]*>is:\s*(.*?)</span>',
        type_evolves_html,
        flags=re.DOTALL
    ))

    subtypes = []
    if supertype == 'Pokémon':
        subtypes = [stage] if stage is not None else []
        if is_value is not None:
            if 'ex' in is_value.lower():
                subtypes.append('ex')
            if 'tera' in is_value.lower():
                subtypes.append('Tera')
    elif trainer_subtype is not None:
        subtypes = [trainer_subtype]

    text_section = search_first_regex_match(
        r'<div class="text">(.*?)</div>\s*(?:<div class="weak-resist-retreat">|<div class="rules minor-text">|<div class="mark-formats)',
        card_html,
        flags=re.DOTALL,
        default=''
    )
    ability_names = [
        html_to_normalized_text(match)
        for match in re.findall(r'Ability</a>\s*⇢\s*([^<]+)<br', text_section, re.DOTALL)
    ]
    attack_names = [
        html_to_normalized_text(match)
        for match in re.findall(r'→\s*<span>([^<]+)</span>', text_section, re.DOTALL)
    ]

    weakness_type = weakness_value = resistance_type = resistance_value = None
    retreat_value = '0'
    if supertype == 'Pokémon':
        weakness_type, weakness_value = search_first_regex_match(
            r'<span class="weak"[^>]*>weak:\s*.*?<abbr title="([^"]+)".*?<span title="Weakness Modifier">([^<]+)</span>',
            card_html,
            flags=re.DOTALL,
            default=(None, None)
        )
        resistance_section = search_first_regex_match(
            r'<span class="resist"[^>]*>.*?</span>\s*\|\s*<span class="retreat"',
            card_html,
            flags=re.DOTALL,
            default=''
        )
        if 'No Resistance' not in resistance_section:
            resistance_type, resistance_value = search_first_regex_match(
                r'<abbr title="([^"]+)".*?<span title="Resistance Modifier">([^<]+)</span>',
                resistance_section,
                flags=re.DOTALL,
                default=(None, None)
            )
        retreat_value = search_first_regex_match(
            r'<span class="retreat"[^>]*>retreat:\s*.*?<abbr title="[^"]*">(\d+)</abbr>',
            card_html,
            flags=re.DOTALL,
            default='0'
        )
    regulation_mark = html_to_normalized_text(search_first_regex_match(
        r'Mark:\s*<a [^>]*>([^<]+)</a>',
        card_html,
        flags=re.DOTALL
    ))
    small_image_url = search_first_regex_match(
        r'<a href="([^"]+)" class="card-image-link"',
        card_html
    )
    species_href = None
    if supertype == 'Pokémon':
        species_href = search_first_regex_match(
            r'<span class="pokemon"[^>]*><a href="https://pkmncards\.com/pokemon/([^"/]+)/"',
            card_html
        )
        if species_href is None:
            species_href = search_first_regex_match(
                r'<span class="pokemon"[^>]*><a href="https://pkmncards\.com/pokemon/([^"/]+)/?"',
                card_html
            )
        if species_href is None:
            raise ValueError(f"Could not parse species slug for promo card {title}")

    card = {
        "id": f"{set_id}-{int(card_number)}",
        "name": get_processed_name(card_name_raw),
        "name_without_prefix": re.sub(
            prefix_replacement_regex,
            '',
            get_maybe_trainer_removed_name(get_processed_name(card_name_raw), supertype)
        ),
        "name_without_prefix_and_postfix": re.sub(
            prefix_replacement_regex,
            '',
            re.sub(
                postfix_replacement_regex,
                '',
                get_maybe_trainer_removed_name(get_processed_name(card_name_raw), supertype)
            )
        ),
        "supertype": supertype,
        "subtypes": subtypes,
        "rarity": "Promo",
        "rarity_for_mismatch_correction": get_rarity_for_mismatch_correction(f"{set_id}-{int(card_number)}", "Promo"),
        "hp": hp,
        "set_id": set_id,
        "set_code": config['set_code'],
        "regulation_mark": regulation_mark,
        "set_name": config['set_name'],
        "number": str(int(card_number)),
        "set_printed_total": promo_set_printed_total_from_card_number(set_id, card_number),
        "small_image_url": small_image_url,
        "types": types if len(types) > 0 else None,
        "national_pokedex_numbers": get_national_pokedex_numbers_for_species_slug(species_href) if species_href is not None else None,
        "evolves_from": get_processed_name(evolves_from) if evolves_from is not None and supertype == 'Pokémon' else None,
        "concatenated_attack_names": '_'.join(attack_names) if len(attack_names) > 0 and supertype == 'Pokémon' else None,
        "abilities": [{'name': ability_name} for ability_name in ability_names],
        "attacks": [{'name': attack_name} for attack_name in attack_names],
        "weaknesses": [{'type': weakness_type, 'value': weakness_value}] if weakness_type is not None else [],
        "resistances": [{'type': resistance_type, 'value': resistance_value}] if resistance_type is not None else [],
        "retreatCost": parse_promo_retreat_cost(retreat_value),
    }
    card["cardMechanicsHash"] = get_card_mechanics_hash(card) if supertype == 'Pokémon' else None
    return card


def fetch_promo_cards_df(existing_card_ids=None):
    promo_cards = []

    for set_id, config in PROMO_SET_CONFIG.items():
        set_url = f"https://pkmncards.com/set/{config['set_slug']}/?display=text"
        set_html = fetch_text_url(set_url)
        set_entries = re.findall(
            r'<a href="(https://pkmncards\.com/card/[^"]+/)" class="card-link" title="[^"]+\(' + config['set_code'] + r'\) #(\d+)"',
            set_html
        )
        print(f"Found {len(set_entries)} entries for {set_id}")

        selected_entries = []
        for card_url, card_number in set_entries:
            card_id = f"{set_id}-{int(card_number)}"
            if existing_card_ids is not None and card_id in existing_card_ids:
                continue
            selected_entries.append((card_url, card_number))

        for index, (card_url, card_number) in enumerate(selected_entries, start=1):
            card_html = fetch_text_url(card_url)
            parsed_card = parse_promo_card_page(card_html, set_id)
            if parsed_card is not None:
                promo_cards.append(parsed_card)

    return pd.DataFrame(promo_cards)


# Around 5000 cards last time I ran this!
def get_cards(): # Returns dataframe
    dfs_list = []
    total_downloaded_cards = 0
    page_number = 1
    processed_cards = None
    
    # get the set info directly from github, to avoid computationally expensive calls to the API
    sets_url = "https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/refs/heads/master/sets/en.json"
    sets_data = json.load(open_url(sets_url))
    
    # only Scarlet & Violet and Mega Evolution sets are currently supported 
    sets_data = [s for s in sets_data if s['series'] == 'Scarlet & Violet' or s['series'] == 'Mega Evolution']

    for set_data in sets_data:
        set_id = set_data['id']
        if set_id in PROMO_SET_CONFIG:
            continue
        print("Downloading info for set " + set_id + " (" + set_data['name'] + ")")
        set_url = "https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/refs/heads/master/cards/en/" + set_id + ".json"
        cards_in_set = json.load(open_url(set_url))
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
                "evolves_from": get_processed_name(card.get('evolvesFrom')) if card.get('evolvesFrom') is not None else None,
                # weird hack - we only use this to match between cards in order to warn users about similar cards that *may* only differ by set info
                "concatenated_attack_names": 
                    '_'.join([attack.get('name') for attack in card.get('attacks')]) if card.get('attacks') and len(card.get('attacks')) > 0 else None,
                "cardMechanicsHash": get_card_mechanics_hash(card) if card.get('supertype') == 'Pokémon' else None,
            } for card in cards_in_set
        ]
        dfs_list.append(pd.DataFrame(processed_cards))
        page_number = page_number + 1
        total_downloaded_cards = total_downloaded_cards + len(processed_cards)
        print("Downloaded info for " + str(total_downloaded_cards) + " cards")

    promo_cards_df = fetch_promo_cards_df()
    if not promo_cards_df.empty:
        dfs_list.append(promo_cards_df)

    concatenated_df = pd.concat(dfs_list, ignore_index=True)

    # Sort the concatenated dataframe so all common, uncommons, and rares are at the beginning
    # Read the rarity from the 'rarity' column, and sort by that
    # This makes certain types of postprocessing easier
    rarity_order = {
        'Common': 1,
        'Uncommon': 2,
        'Rare': 3,
        'Rare Holo': 4,
        'Double Rare': 5,
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
    
    # always include "rocky" for "rocky fighting energy"
    if target_name.lower() == "rocky fighting energy":
        return ["Rocky", target_name]

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
        "mep-29",
        "mep-30",
        "mep-34",
        "mep-35",
        "mep-36",
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
        "mep-7", # Psyduck
    ]:
        return 'Common'
    
    if card_id in [
        "mep-8", # Golduck
    ]:
        return 'Uncommon'
    
   
    return rarity


def add_similar_card_ids_to_df(cards_df):
    # function that adds a column to the df to help tell the user if they might be mis-scanning a card
    
    # group together cards with the same mechanics hash
    # if these match, the cards are mechanically identical and can safely swap art
    cards_df = cards_df.assign(
        similar_card_ids = cards_df.apply(
            lambda row: cards_df[
                (row['cardMechanicsHash'] is not None) &
                (cards_df['cardMechanicsHash'] == row['cardMechanicsHash']) &
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
            download_url_to_file(card["small_image_url"], img_path)
        # else:
        #     print("#" + str(index + 1) + ": " + img_path + " already exists; skipping download")
        shutil.copy(img_path, CLIENT_CARD_IMAGES_DIRECTORY + "/" + file_name)

        if card["supertype"] == 'Pokémon':
            name_without_prefix_and_postfix = card["name_without_prefix_and_postfix"]
            sprite_file_name = re.sub(
                sprite_url_replacement_regex,
                '',
                normalize_name_for_sprite_filename(name_without_prefix_and_postfix)
            ) + ".png"
            sprite_path = SPRITES_DIRECTORY + '/' + sprite_file_name
            sprite_url = 'https://r2.limitlesstcg.net/pokemon/gen9/' + sprite_file_name
            if not os.path.isfile(sprite_path):
                print("#" + str(index + 1) + ": Downloading " + sprite_url + " to " + sprite_path)
                downloaded = try_download_url_to_file(sprite_url, sprite_path)
                if not downloaded:
                    national_pokedex_numbers = card.get('national_pokedex_numbers') or []
                    if len(national_pokedex_numbers) == 0:
                        raise ValueError(f"No national pokedex number available for sprite fallback: {card['id']}")
                    fallback_sprite_url = (
                        "https://raw.githubusercontent.com/PokeAPI/sprites/master/"
                        f"sprites/pokemon/other/home/{national_pokedex_numbers[0]}.png"
                    )
                    print(
                        "#" + str(index + 1) + ": Sprite not found by name, "
                        + "falling back to " + fallback_sprite_url
                    )
                    download_url_to_file(fallback_sprite_url, sprite_path)
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

            cropped.convert('RGBA').save(energy_symbol_path)

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

            cropped.convert('RGBA').save(trainer_symbol_path)

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
    
    # Drop intermediate mechanics fields before export; only the hash is used by the client.
    export_only_columns_to_drop = [
        'concatenated_attack_names',
        'rarity_for_mismatch_correction',
        'abilities',
        'attacks',
        'weaknesses',
        'resistances',
        'retreatCost',
    ]
    cards_df = cards_df.drop(
        columns=[column for column in export_only_columns_to_drop if column in cards_df.columns]
    )

    download_missing_card_images_and_sprites_for_df(cards_df)

    cards_dict = {}
    for i, card in cards_df.iterrows():
        card_dict = card.to_dict()
        if card_dict.get('supertype') != 'Pokémon':
            card_dict.pop('cardMechanicsHash', None)
        cards_dict[card['id']] = card_dict
    with open('../client/public/card_database.json', 'w') as f:
        json.dump(cards_dict, f)

    print("Done!")
