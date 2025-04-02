import request from "./request";


// export const refreshAccessToken = async (): { access_token: string } => {
//     return request()
//         (isPartner ? getRefreshedPartnerAccessToken() : getRefreshedAccessToken())
//             .then((result) => {
//                 if (!result.access_token || !result.expires_in) {
//                     resolve(false);
//                     return;
//                 }

//                 setAccessToken(result.access_token, result.expires_in);
//                 resolve(true);
//             })
//             .catch(() => {
//                 resolve(false);
//             });
//     });
