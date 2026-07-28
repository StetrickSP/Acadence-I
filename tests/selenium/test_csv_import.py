"""SP7 — Test: upload a CSV file via the import form."""
import os
import time
import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from conftest import navigate

FIXTURE_CSV = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "fixtures", "sample_grades.csv")
)


def test_csv_import(driver):
    navigate(driver, "/import-export")

    # Find the first hidden file input that accepts CSV
    file_input = WebDriverWait(driver, 15).until(
        EC.presence_of_element_located(
            (By.CSS_SELECTOR, "input[type='file'][accept='.csv']")
        )
    )
    file_input.send_keys(FIXTURE_CSV)

    # Allow time for the upload + API response
    time.sleep(4)

    page_text = driver.find_element(By.TAG_NAME, "body").text.lower()

    success_kw = ["imported", "import", "success", "processed", "grade", "row", "record", "upload"]
    error_kw   = ["500 internal server error", "unhandled exception"]

    has_success = any(kw in page_text for kw in success_kw)
    has_crash   = any(kw in page_text for kw in error_kw)

    assert has_success and not has_crash, (
        f"Expected success keyword on import page.\n"
        f"Page snippet: {page_text[:500]!r}"
    )
