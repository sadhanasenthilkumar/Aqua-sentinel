
import requests

DAMS = {
    "mettur": {
        "name": "Mettur Dam",
        "district": "Salem",
        "latitude": 11.845343,
        "longitude": 77.741936
    },
    "bhavanisagar": {
        "name": "Bhavanisagar Dam",
        "district": "Erode",
        "latitude": 11.4775,
        "longitude": 77.133
    },
    "vaigai": {
        "name": "Vaigai Dam",
        "district": "Theni",
        "latitude": 10.068,
        "longitude": 77.583
    },
    "papanasam": {
        "name": "Papanasam Dam",
        "district": "Tirunelveli",
        "latitude": 8.701,
        "longitude": 77.37
    },
    "sathanur": {
        "name": "Sathanur Dam",
        "district": "Tiruvannamalai",
        "latitude": 12.10,
        "longitude": 78.85
    }
}


def get_rainfall(latitude, longitude):
    url = "https://api.open-meteo.com/v1/forecast"

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": "precipitation,rain",
        "daily": "rain_sum,precipitation_sum",
        "forecast_days": 7,
        "timezone": "Asia/Kolkata"
    }

    response = requests.get(url, params=params, timeout=30)
    response.raise_for_status()
    return response.json()


def get_all_dams_rainfall():
    results = []

    for slug, dam in DAMS.items():
        try:
            weather = get_rainfall(
                dam["latitude"],
                dam["longitude"]
            )

            results.append({
                "reservoir_slug": slug,
                "dam": dam["name"],
                "district": dam["district"],
                "coordinates": {
                    "latitude": dam["latitude"],
                    "longitude": dam["longitude"]
                },
                "current": weather.get("current"),
                "daily_forecast": weather.get("daily"),
                "source": "Open-Meteo",
                "data_type": "Weather model estimate, not rain-gauge observation"
            })

        except requests.RequestException as error:
            results.append({
                "reservoir_slug": slug,
                "dam": dam["name"],
                "error": str(error)
            })

    return results
from datetime import date, timedelta


def get_rainfall_history(latitude, longitude, days=30):
    end_date = date.today() - timedelta(days=1)
    start_date = end_date - timedelta(days=days - 1)

    url = "https://archive-api.open-meteo.com/v1/archive"

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "daily": "rain_sum,precipitation_sum",
        "timezone": "Asia/Kolkata"
    }

    response = requests.get(url, params=params, timeout=30)
    response.raise_for_status()

    return response.json()