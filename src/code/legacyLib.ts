export const LegacyLib = `
declare module context {
    function getQuery(): Record<string, any>;
    function getUserInfo(): Record<string, any>;
    function hasPermission(): boolean;
    module utils {
      function getParams(): Record<string, any>;
      function getCookies(): Record<string, any>;
      function moment(params?: any): any;
    }
  }
`;