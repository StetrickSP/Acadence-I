"""Shared Selenium fixtures for Acadence data-entry tests."""
import os
import subprocess
import time
import pytest
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# ── URL helpers ───────────────────────────────────────────────────────────────

def _base_url() -> str:
    override = os.environ.get("BASE_URL", "")
    if override:
        return override.rstrip("/")
    domain = os.environ.get("REPLIT_DEV_DOMAIN", "")
    if domain:
        return f"https://{domain}"
    return "http://localhost:19471"


BASE_URL = _base_url()

# ── ChromeDriver / Chromium paths ─────────────────────────────────────────────

def _which(cmd: str) -> str:
    try:
        return subprocess.check_output(["which", cmd], text=True).strip()
    except subprocess.CalledProcessError:
        return ""


CHROMEDRIVER_PATH = _which("chromedriver")
CHROMIUM_PATH     = _which("chromium")

# ── Driver fixture (one session for all tests) ───────────────────────────────

@pytest.fixture(scope="session")
def driver():
    opts = Options()
    opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--window-size=1280,960")
    if CHROMIUM_PATH:
        opts.binary_location = CHROMIUM_PATH

    svc = Service(executable_path=CHROMEDRIVER_PATH) if CHROMEDRIVER_PATH else Service()
    d = webdriver.Chrome(service=svc, options=opts)
    d.implicitly_wait(0)   # we do all our own waiting

    # ── Demo login ────────────────────────────────────────────────────────────
    d.get(f"{BASE_URL}/login")
    wait = WebDriverWait(d, 20)

    email_el = wait.until(
        EC.presence_of_element_located((By.CSS_SELECTOR, "[data-testid='input-email']"))
    )
    react_fill(d, email_el, "teacher@gmail.com")

    pwd_el = d.find_element(By.CSS_SELECTOR, "[data-testid='input-password']")
    react_fill(d, pwd_el, "1111")

    d.find_element(By.CSS_SELECTOR, "[data-testid='button-signin']").click()
    wait.until(EC.url_contains("/dashboard"))
    time.sleep(1.0)

    yield d
    d.quit()


# ── React native-setter fill ──────────────────────────────────────────────────

_INPUT_SCRIPT = """
    var el=arguments[0], v=arguments[1];
    var setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
    setter.call(el,v);
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
"""


def react_fill(driver, element, value: str):
    driver.execute_script(_INPUT_SCRIPT, element, str(value))


# ── Convenience helpers ───────────────────────────────────────────────────────

def navigate(driver, path: str):
    """Navigate to a page and wait for it to settle."""
    driver.get(f"{BASE_URL}{path}")
    WebDriverWait(driver, 15).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, "body"))
    )
    time.sleep(0.8)


def wait_visible(driver, css: str, timeout: int = 15):
    return WebDriverWait(driver, timeout).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, css))
    )


def wait_for(driver, testid: str, timeout: int = 15):
    return wait_visible(driver, f"[data-testid='{testid}']", timeout)


def js_click(driver, element):
    driver.execute_script("arguments[0].scrollIntoView({block:'center'});", element)
    time.sleep(0.1)
    driver.execute_script("arguments[0].click();", element)


def click(driver, testid: str):
    js_click(driver, wait_for(driver, testid))


def fill(driver, testid: str, value: str):
    el = wait_for(driver, testid)
    react_fill(driver, el, str(value))


def open_dialog_combobox(driver, index: int = 0):
    """
    Find all role='combobox' elements that are *inside* an open dialog
    (role='dialog') and JS-click the one at *index*.
    Returns True if an option list appeared.
    """
    wait = WebDriverWait(driver, 10)
    # Prefer comboboxes scoped to the open dialog; fall back to all
    boxes = driver.find_elements(
        By.CSS_SELECTOR, "[role='dialog'] [role='combobox']"
    )
    if not boxes:
        boxes = driver.find_elements(By.CSS_SELECTOR, "[role='combobox']")

    box = boxes[index]
    js_click(driver, box)
    try:
        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "[role='option']")))
        return True
    except Exception:
        return False


def pick_first_option(driver):
    """Click the first visible option in a currently-open shadcn dropdown."""
    option = WebDriverWait(driver, 8).until(
        EC.element_to_be_clickable((By.XPATH, "(//div[@role='option'])[1]"))
    )
    js_click(driver, option)
    time.sleep(0.2)


def submit_and_wait(driver, submit_testid: str, settle: float = 2.0):
    """Click a submit button and wait for the dialog to close (or settle)."""
    click(driver, submit_testid)
    # Wait for the submit button to disappear (dialog closed) — allow up to 8 s
    try:
        WebDriverWait(driver, 8).until(
            EC.invisibility_of_element_located(
                (By.CSS_SELECTOR, f"[data-testid='{submit_testid}']")
            )
        )
    except Exception:
        pass   # dialog may stay open on dup; we check the result independently
    time.sleep(settle)
