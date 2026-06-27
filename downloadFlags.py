import os
import requests
from pathlib import Path

def download_flags():
    # Map of country names to ISO codes for 2026 World Cup participants
    flags = {
        # Hosts
        'Canada': 'ca',
        'Mexico': 'mx',
        'United States': 'us',

        # AFC (Asia)
        'Australia': 'au',
        'Iran': 'ir',
        'Iraq': 'iq',
        'Japan': 'jp',
        'Jordan': 'jo',
        'Qatar': 'qa',
        'Saudi Arabia': 'sa',
        'South Korea': 'kr',
        'Uzbekistan': 'uz',

        # CAF (Africa)
        'Algeria': 'dz',
        'Cabo Verde': 'cv',
        'DR Congo': 'cd',
        'Egypt': 'eg',
        'Ghana': 'gh',
        'Ivory Coast': 'ci',
        'Morocco': 'ma',
        'Senegal': 'sn',
        'South Africa': 'za',
        'Tunisia': 'tn',

        # CONCACAF (North & Central America)
        'Curaçao': 'cw',
        'Haiti': 'ht',
        'Panama': 'pa',

        # CONMEBOL (South America)
        'Argentina': 'ar',
        'Brazil': 'br',
        'Colombia': 'co',
        'Ecuador': 'ec',
        'Paraguay': 'py',
        'Uruguay': 'uy',

        # OFC (Oceania)
        'New Zealand': 'nz',

        # UEFA (Europe)
        'Austria': 'at',
        'Belgium': 'be',
        'Bosnia and Herzegovina': 'ba',
        'Croatia': 'hr',
        'Czechia': 'cz',
        'England': 'gb-eng',
        'France': 'fr',
        'Germany': 'de',
        'Netherlands': 'nl',
        'Norway': 'no',
        'Portugal': 'pt',
        'Scotland': 'gb-sct',
        'Spain': 'es',
        'Sweden': 'se',
        'Switzerland': 'ch',
        'Turkey': 'tr'
    }

    # Create output directory
    output_dir = Path('world_cup_2026_flags')
    output_dir.mkdir(exist_ok=True)

    # Base URL for flagcdn
    base_url = 'https://flagcdn.com/w160'

    successful = 0
    failed = 0

    print(f"Downloading {len(flags)} flag images...\n")

    for country, code in flags.items():
        url = f"{base_url}/{code}.png"
        filename = f"{country.replace(' ', '_').replace('&', 'and')}.png"
        filepath = output_dir / filename

        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()

            with open(filepath, 'wb') as f:
                f.write(response.content)

            successful += 1
            print(f"✓ Downloaded: {country}")

        except Exception as e:
            failed += 1
            print(f"✗ Failed: {country} - {str(e)}")

    print(f"\n{'='*50}")
    print(f"Download complete!")
    print(f"Successful: {successful}")
    print(f"Failed: {failed}")
    print(f"Total: {successful + failed}")
    print(f"Saved to: {output_dir.absolute()}")

if __name__ == '__main__':
    # Install requests if not already installed: pip install requests
    download_flags()