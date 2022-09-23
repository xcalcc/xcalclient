import os
import json
import logging.config


def setup_logging(
    default_path='logging.json',
    default_level=logging.INFO,
    env_key='LOG_CFG'
):
    """Setup logging configuration

    """
    path = default_path
    level = default_level
    value = os.getenv(env_key, None)
    if value:
        path = value
    if os.path.exists(path):
        with open(path, 'rt') as f:
            config = json.load(f)
            if config.get("root").get("level"):
                config["root"]["level"] = level
        logging.config.dictConfig(config)
    else:
        basic_format = "%(asctime)s - %(levelname)s - %(name)s - %(message)s"
        logging.basicConfig(format = basic_format, level=level)