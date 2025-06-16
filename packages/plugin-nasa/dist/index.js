// src/actions/getAPOD.ts
import {
  elizaLogger
} from "@elizaos/core";

// src/environment.ts
import { z } from "zod";
var nasaEnvSchema = z.object({
  NASA_API_KEY: z.string().min(1, "Nasa API key is required")
});
async function validateNasaConfig(runtime) {
  try {
    const config = {
      NASA_API_KEY: runtime.getSetting("NASA_API_KEY")
    };
    console.log("config: ", config);
    return nasaEnvSchema.parse(config);
  } catch (error) {
    console.log("error::::", error);
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join("\n");
      throw new Error(
        `Nasa API configuration validation failed:
${errorMessages}`
      );
    }
    throw error;
  }
}

// src/examples.ts
var getMarsRoverExamples = [
  [
    {
      user: "{{user1}}",
      content: {
        text: "I wonder what mars looks like today?"
      }
    },
    {
      user: "{{agent}}",
      content: {
        text: "Let me fetch a picture from a mars rover.",
        action: "NASA_GET_MARS_ROVER_PHOTO"
      }
    }
  ],
  [
    {
      user: "{{user1}}",
      content: {
        text: "Can you fetch a random picture of Mars?"
      }
    },
    {
      user: "{{agent}}",
      content: {
        text: "Let me fetch a picture from a mars rover.",
        action: "NASA_GET_MARS_ROVER_PHOTO"
      }
    }
  ]
];
var getAPODExamples = [
  [
    {
      user: "{{user1}}",
      content: {
        text: "What's the nasa Astronomy picture of the day?"
      }
    },
    {
      user: "{{agent}}",
      content: {
        text: "Let me get the nasa image of the day.",
        action: "NASA_GET_APOD"
      }
    }
  ],
  [
    {
      user: "{{user1}}",
      content: {
        text: "I love space."
      }
    },
    {
      user: "{{agent}}",
      content: {
        text: "Oh really, then let me get the nasa image of the day to make your day even better.",
        action: "NASA_GET_APOD"
      }
    }
  ],
  [
    {
      user: "{{user1}}",
      content: {
        text: "I am in love with space and space travel."
      }
    },
    {
      user: "{{agent}}",
      content: {
        text: "Space is beautiful, dark, scary, and vast. Would you like to see a current photo of space from NASA?"
      }
    },
    {
      user: "{{user1}}",
      content: {
        text: "yes"
      }
    },
    {
      user: "{{agent}}",
      content: {
        text: "Here is the NASA Astronomy Picture of the Day.",
        action: "NASA_GET_APOD"
      }
    }
  ],
  [
    {
      user: "{{user1}}",
      content: {
        text: "Space is beautiful, dark, scary, and unfathomably vast."
      }
    },
    {
      user: "{{agent}}",
      content: {
        text: "Indeed! Would you like to see a current photo from the NASA astronomy database?"
      }
    },
    {
      user: "{{user1}}",
      content: {
        text: "yes"
      }
    },
    {
      user: "{{agent}}",
      content: {
        text: "Here is the NASA Astronomy Picture of the Day.",
        action: "NASA_GET_APOD"
      }
    }
  ],
  [
    {
      user: "{{user1}}",
      content: {
        text: "I'm a big fan of space and astronomy."
      }
    },
    {
      user: "{{agent}}",
      content: {
        text: "Would you like to see the Nasa Astronomy Picture of the Day?"
      }
    },
    {
      user: "{{user1}}",
      content: {
        text: "yes"
      }
    },
    {
      user: "{{agent}}",
      content: {
        text: "Here is the NASA Astronomy Picture of the Day.",
        action: "NASA_GET_APOD"
      }
    }
  ]
];

// src/services.ts
var BASE_URL = "https://api.nasa.gov/planetary/apod?api_key=";
var createNASAService = (apiKey) => {
  const getAPOD = async () => {
    if (!apiKey) {
      throw new Error("Invalid parameters");
    }
    try {
      const url = BASE_URL + apiKey;
      const response = await fetch(url);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error?.message || response.statusText);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("NASA API Error:", error.message);
      throw error;
    }
  };
  const getMarsRoverPhoto = async () => {
    try {
      const data = await fetchMarsPhotos(apiKey);
      return data;
    } catch (error) {
      console.error("NASA Mars Rover API Error:", error.message);
      throw error;
    }
  };
  return { getAPOD, getMarsRoverPhoto };
};
async function fetchMarsPhotos(apiKey, attempts = 0, maxAttempts = 10) {
  try {
    const curiosityCameras = [
      "FHAZ",
      "RHAZ",
      "MAST",
      "CHEMCAM",
      "MAHLI",
      "MARDI",
      "NAVCAM"
    ];
    const opportunityCameras = [
      "FHAZ",
      "RHAZ",
      "PANCAM",
      "MINITES"
    ];
    const CURIOUSITY_MAX_SOL = 3400;
    const OPPORTUNITY_MAX_SOL = 4500;
    const rovers = {
      curiosity: {
        cameras: curiosityCameras,
        maxSol: CURIOUSITY_MAX_SOL
      }
      //   opportunity: {
      //     cameras: opportunityCameras,
      //     maxSol: OPPORTUNITY_MAX_SOL
      //   },
    };
    const roverNames = Object.keys(rovers);
    const randomRover = roverNames[Math.floor(Math.random() * roverNames.length)];
    const selectedRover = rovers[randomRover];
    const randomCamera = selectedRover.cameras[Math.floor(Math.random() * selectedRover.cameras.length)];
    const randomSol = Math.floor(Math.random() * selectedRover.maxSol) + 1;
    const requestURL = `https://api.nasa.gov/mars-photos/api/v1/rovers/${randomRover}/photos?sol=${randomSol}&camera=${randomCamera}&api_key=${apiKey}`;
    console.log("requestURL::::::: ", requestURL);
    const response = await fetch(requestURL);
    const data = await response.json();
    if (data.photos.length) {
      const returnObj = {
        photo: data.photos[0].img_src,
        sol: randomSol,
        camera: randomCamera,
        rover: randomRover
      };
      return returnObj;
    } else if (attempts < maxAttempts) {
      return fetchMarsPhotos(apiKey, attempts + 1, maxAttempts);
    } else {
      throw new Error("No photos found after maximum attempts");
    }
  } catch (err) {
    console.log("error fetch mar rover photos ...", err);
  }
}

// src/actions/getAPOD.ts
var getAPODAction = {
  name: "NASA_GET_APOD",
  similes: [
    "ASTRONOMY",
    "SPACE",
    "NASA",
    "PLANETS"
  ],
  description: "Get the Nasa Astronomy Picture of the Day.",
  validate: async (runtime) => {
    await validateNasaConfig(runtime);
    return true;
  },
  handler: async (runtime, message, state, _options, callback) => {
    const config = await validateNasaConfig(runtime);
    const nasaService = createNASAService(
      config.NASA_API_KEY
    );
    try {
      const APODData = await nasaService.getAPOD();
      elizaLogger.success(
        `Successfully fetched APOD`
      );
      if (callback) {
        callback({
          text: `Here is the NASA Astronomy Picture of the Day: ${APODData.url}`
        });
        return true;
      }
    } catch (error) {
      elizaLogger.error("Error in NASA plugin handler:", error);
      callback({
        text: `Error fetching APOD: ${error.message}`,
        content: { error: error.message }
      });
      return false;
    }
  },
  examples: getAPODExamples
};

// src/actions/getMarsRoverPhoto.ts
import {
  elizaLogger as elizaLogger2
} from "@elizaos/core";
var getMarsRoverAction = {
  name: "NASA_GET_MARS_ROVER_PHOTO",
  similes: [
    "MARS",
    "MARTIAN",
    "MARS PHOTO"
  ],
  description: "Get a random Nasa Mars Rover Photo.",
  validate: async (runtime) => {
    await validateNasaConfig(runtime);
    return true;
  },
  handler: async (runtime, message, state, _options, callback) => {
    const config = await validateNasaConfig(runtime);
    const nasaService = createNASAService(
      config.NASA_API_KEY
    );
    try {
      const MarsRoverData = await nasaService.getMarsRoverPhoto();
      elizaLogger2.success(
        `Successfully fetched Mars Rover Photo`
      );
      if (callback) {
        callback({
          text: `
                    Here is a photo from the ${MarsRoverData.rover} on day ${MarsRoverData.sol} from the ${MarsRoverData.camera} camera.

                    ${MarsRoverData.photo}
                    `
        });
        return true;
      }
    } catch (error) {
      elizaLogger2.error("Error in NASA plugin handler:", error);
      callback({
        text: `Error fetching Mars Rover Photo: ${error.message}`,
        content: { error: error.message }
      });
      return false;
    }
  },
  examples: getMarsRoverExamples
};

// src/index.ts
var nasaPlugin = {
  name: "nasa",
  description: "NASA plugin for Eliza",
  actions: [getAPODAction, getMarsRoverAction],
  // evaluators analyze the situations and actions taken by the agent. they run after each agent action
  // allowing the agent to reflect on what happened and potentially trigger additional actions or modifications
  evaluators: [],
  // providers supply information and state to the agent's context, help agent access necessary data
  providers: []
};
var index_default = nasaPlugin;
export {
  index_default as default,
  nasaPlugin
};
//# sourceMappingURL=index.js.map