import type { ElementHandle, Page, Protocol } from "puppeteer";
import { UserInfo } from "../types/user";
import * as admin from "firebase-admin";
require('dotenv').config();


/**
 * Initialize the linkedIn session and return the requested user info
 *
 * @param {Page} page The puppeteer page instance
 * @param {string} [nameAndCompany] The name and company of the user to search for
 * @param {string} [url] The url of the user to get info from
 * @return {*} {Promise<UserInfo | UserInfo[]>}
 */
async function linkedInSession(
    page: Page,
    nameAndCompany?: {
        name: string;
        company: string;
    },
    url?: string,
): Promise<UserInfo[] | UserInfo | null> {
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
        console.log('finished logging in');
        console.log(page.url());
        await page.setCookie(...cookies);
    }

    let result: UserInfo | UserInfo[] = [];

    if (url) {
        console.log('getting user from url');
        result = await getUserFromUrl(page, url);
    } else if (nameAndCompany) {
        console.log('searching for user', nameAndCompany);
        result = await searchUser(page, nameAndCompany);
    }

    return result;
}

/**
 * Log in to LinkedIn
 *
 * @param {Page} page The puppeteer page instance
 * @param {boolean} [alreadyOnLoginPage=false] Whether or not the page is already on the login page
 * @return {*} {Promise<puppeteer.Cookie[]>}
 */
async function authenticate(page: Page, alreadyOnLoginPage: boolean = false): Promise<Protocol.Network.Cookie[]> {
    console.log('in authenticate');
    if (!page) {
        console.log("No page provided");
    }

    if (!alreadyOnLoginPage) {
        await page.goto("https://www.linkedin.com/login");
    }

    console.log(page.url());

    if (await page.$$eval('#username', (el) => el.length) === 0) {
        await page.type("#password", process.env.LINKEDIN_PASSWORD!);
    } else {
        await page.type("#username", process.env.LINKEDIN_USERNAME!);
        await page.type("#password", process.env.LINKEDIN_PASSWORD!);
    }

    await page.click(".btn__primary--large");

    console.log('logged in')

    const cookies = await page.cookies();

    console.log(page.url());

    console.log('updating cookies');

    await admin
        .firestore()
        .collection("cookies")
        .doc("cookies")
        .set({ cookies: cookies })
        .catch((err) => {
            console.log("Error updating document", err);
        });
        

    return cookies;
}

/**
 * Search for a user on LinkedIn
 *
 * @param {Page} page The puppeteer page instance
 * @param {string} query The name and company of the user to search for
 * @return {*} {Promise<UserInfo[]>}
 */
async function searchUser(page: Page, query: {name: string, company: string}): Promise<UserInfo[]> {
  const queryString = `${query.name} ${query.company}`;
  const url = `https://www.linkedin.com/search/results/people/?keywords=${queryString}&origin=GLOBAL_SEARCH_HEADER`;

  await page.goto(url);

  if (page.url().includes("signup")) {
    await page.click(".main__sign-in-link");

    await authenticate(page, true);

    await page.goto(url);
  }

  let elements: ElementHandle<Element>[];

  // Check if there is an h2 with the text "No results found"
  const noResults = await page.$('h2.artdeco-empty-state__headline');

  if (noResults) {
    const newUrl = `https://www.linkedin.com/search/results/people/?keywords=${query.name}&origin=GLOBAL_SEARCH_HEADER`;
    await page.goto(newUrl);
    elements = await page.$$("div.entity-result__item");
  } else {
    elements = await selectQuery(page, "div.entity-result__item");
  }

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
        name: name,
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

/**
 * Get the user info from a LinkedIn profile url
 *
 * @param {Page} page The puppeteer page instance
 * @param {string} url The url of the user to get info from
 * @return {*} {Promise<UserInfo>}
 */
async function getUserFromUrl(page: Page, url: string): Promise<UserInfo> {
    await page.goto(url);

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

/**
 * Select an element from the page
 *
 * @param {Page} page The puppeteer page instance
 * @param {string} query The query to select the element
 * @param {number} [timeout] The timeout for the query
 * @return {*}  {Promise<ElementHandle<Element>[]>}
 */
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

export { linkedInSession };
