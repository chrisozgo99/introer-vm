import puppeteer from "puppeteer";
import type { Browser, ElementHandle, Page } from "puppeteer";
import { Cluster } from "puppeteer-cluster";
import { UserInfo } from "../types/user";
import * as admin from "firebase-admin";
require('dotenv').config();

/**
 * Initialize the browser instance
 *
 * @param {(Browser | undefined)} browser
 * @return {*} browser
 */
async function getBrowser(browser: Browser | undefined): Promise<Browser> {
    const puppeteerConfig = {
        headless: "new" as "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      };

    if (browser) {
        return browser;
    } else {
        return await puppeteer.launch(puppeteerConfig);
    }
}


/**
 * Initialize the browser cluster instance
 *
 * @param {*} cluster
 * @return {*}  {Promise<any>}
 */
async function getBrowserCluster(cluster: any): Promise<Cluster<any, any>> {
    if (cluster) {
        return cluster;
    } else {
        return await Cluster.launch({
            concurrency: Cluster.CONCURRENCY_CONTEXT,
            maxConcurrency: 2,
            puppeteerOptions: {
                headless: "new",
                args: ["--no-sandbox", "--disable-setuid-sandbox"],
            },
          });
    }
}

async function linkedInSession(
    page: Page,
    name?: string,
    url?: string,
) {
    const cookies = await admin
        .firestore()
        .collection("cookies")
        .doc("cookies")
        .get()
        .then((doc) => {
            if (!doc.exists) {
                console.log("No such document!");
                return null;
            } else {
                console.log("Document exists");
                return doc.data();
            }
        })
        .catch((err) => {
            console.log("Error getting document", err);
            return null;
        }
    );

    if (cookies) {
        console.log('cookies found');
        await page.setCookie(...cookies.cookies);
    } else {
        console.log('no cookies found. logging in');
        const cookies = await authenticate(page);
        await page.setCookie(...cookies);
    }

    let result: UserInfo | UserInfo[] = [];

    if (url) {
        console.log('getting user from url');
        result = await getUserFromUrl(page, url);
    } else if (name) {
        console.log('searching for user');
        result = await searchUser(page, name);
    }

    return result;
}

async function authenticate(page: Page, alreadyOnLoginPage = false) {
    if (!page) {
        console.log("No page provided");
    }

    if (!alreadyOnLoginPage) {
        await page.goto("https://www.linkedin.com/login");
    }

    if (await page.$$eval('#username', (el) => el.length) === 0) {
        await page.type("#password", process.env.LINKEDIN_PASSWORD!);
    } else {
        await page.type("#username", process.env.LINKEDIN_USERNAME!);
        await page.type("#password", process.env.LINKEDIN_PASSWORD!);
    }

    await page.click(".btn__primary--large");

    console.log('logged in')

    const cookies = await page.cookies();

    await admin
        .firestore()
        .collection("cookies")
        .doc("cookies")
        .set({ cookies: cookies });

    return cookies;
}

async function searchUser(page: Page, name: string) {
  const url = `https://www.linkedin.com/search/results/people/?keywords=${name}&origin=GLOBAL_SEARCH_HEADER`;

  await page.goto(url);

  if (page.url().includes("signup")) {
    await page.click(".main__sign-in-link");

    await authenticate(page, true);

    await page.goto(url);
  }

  const elements = await selectQuery(page, "div.entity-result__item");

  const contentPromises = elements.map(async (element: ElementHandle<Element>) => {
    const profilePhoto = await page.evaluate((el) => {
      const imgElement = el.querySelector(".presence-entity__image");
      return imgElement?.getAttribute("src") ?? "";
    }, element);

    const name = await page.evaluate((el) => {
      const spanElement = el.querySelector(
        ".entity-result__title-text a span span"
      );
      return spanElement?.textContent ?? "";
    }, element);

    const title = await page.evaluate((el) => {
      const divElement = el.querySelector(".entity-result__primary-subtitle");
      return divElement?.textContent ?? "";
    }, element);

    const location = await page.evaluate((el) => {
      const divElement = el.querySelector(".entity-result__secondary-subtitle");
      return divElement?.textContent ?? "";
    }, element);

    const linkedInUrl = await page.evaluate((el) => {
      const aElement = el.querySelector(".app-aware-link");
      return aElement?.getAttribute("href") ?? "";
    }, element);

    const user: UserInfo = {
        name,
        title: title.split("\n")[1].trim(),
        location: location.split("\n")[1].trim(),
        profilePhoto,
        linkedInUrl,
    };

    return user;
  });

  const content = await Promise.all(contentPromises);

  return content;
}

async function getUserFromUrl(page: Page, url: string) {
    await page.goto(url);
    // await page.waitForNavigation({ waitUntil: "networkidle0" });
  
    if (page.url().includes("authwall") || page.url().includes("checkpoint")) {
      console.log("Tried to make us authenticate...authenticating");
      await authenticate(page);
  
      await page.goto(url);
      await page.waitForSelector("main.scaffold-layout__main");
    }
  
    console.log("Beat the authwall");
  
    const elements = await selectQuery(page, "main.scaffold-layout__main");
  
    const profilePicture = await page.evaluate((html) => {
      const imgElement = html.querySelector(
        "img.pv-top-card-profile-picture__image"
      );
      return imgElement?.getAttribute("src") ?? "";
    }, elements[0]);
  
    const name = await page.evaluate((html) => {
      const h1Element = html.querySelector(
        "div.pv-text-details__left-panel > div > h1"
      );
      return h1Element?.textContent ?? "";
    }, elements[0]);
  
    // The user's occupation (if they are employed, it is their job,
    //  otherwise it is their school)
    // const occupation = await page.evaluate((html) => {
    //   const occupationElement = html.querySelector(
    //     "li.pv-text-details__right-panel-item > button > span > div"
    //   );
    //   return occupationElement?.textContent ?? "";
    // }, elements[0]);
  
    const location = await page.evaluate((html) => {
      const locationElement = html.querySelector(
        // eslint-disable-next-line max-len
        "section.artdeco-card > div.ph5 > div.mt2 > div.pv-text-details__left-panel > span"
      );
      return locationElement?.textContent ?? "";
    }, elements[0]);
  
    // The user's bio
    // const description = await page.evaluate((html) => {
    //   const divElement = html.querySelector("div.text-body-medium.break-words")
    //   return divElement?.textContent ?? "";
    // }, elements[0]);
  
    // The one liner that is displayed on the profile
    // const oneLiner = await page.evaluate((html) => {
    //   const spanElement = html.querySelector(
    //     "div.pv-shared-text-with-see-more > div > span"
    //   );
    //   return spanElement?.textContent ?? "";
    // }, elements[0]);
  
    const firstSpanText = await page.evaluate((html) => {
      const spanElement = html.querySelector(
        // eslint-disable-next-line max-len
        "div.pvs-list__item--no-padding-in-columns > div.display-flex > div > div > div > div > div > div > span"
      );
      return spanElement?.textContent ?? "";
    }, elements[0]);
  
    const secondSpanText = await page.evaluate((html) => {
      const spanElement = html.querySelector(
        // eslint-disable-next-line max-len
        "div.pvs-list__item--no-padding-in-columns > div > div > div > span > span"
      );
      return spanElement?.textContent ?? "";
    }, elements[0]);
  
    // Get the user's info
    const user: UserInfo = {
      name,
      title: firstSpanText + " at " + secondSpanText.split(" ·")[0],
      location: location?.split("\n")[1]?.trim(),
      profilePhoto: profilePicture,
      linkedInUrl: url,
    };
  
    console.log("Returning user");
  
    return user;
}

async function selectQuery(
    page: Page,
    query: string,
    timeout?: number
  ): Promise<ElementHandle<Element>[]> {
    await page.waitForSelector(query, { timeout: timeout ?? 30000 });
    const elements = await page.$$(query);
    if (elements.length <= 0) {
      throw new Error(`Could not find element with query: ${query}`);
    }
  
    return elements;
  }

export { getBrowser, getBrowserCluster, linkedInSession };
