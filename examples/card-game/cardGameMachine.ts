import { createMachine } from "mobxstate";

import type { CardGameMachineEvent } from "../types";

export const cardGameMachine = createMachine(
  {
    /** @xstate-layout N4IgpgJg5mDOIC5SwC4EMBOKDiaC2YAsmgMYAWAlgHZgB0U+YAYgDYD2A7gMQAyAogEEAanwD6AFQASY7AMJ8A2gAYAuolAAHNrAooKbKupAAPRAFoAjAFYAzAE5aAdgAszm86tKbVu3ccAaEABPRHsAJlorRxsLVwA2GwAOJV8lKwBfdMDUTBxGYnJqOgYCVk4uAHkAOVE+ACU6irrlNSQQLR09AyNTBBslC1pYqzi4uySPJWcEwJCES0c45yc4iwtHJWiouLTM7PQsXAICyhp6RjKOWmpdLmMclDo0ADNHjAAKCyUlAEouHMO+VIp2KF3YVxuKBaRg6un0hjavTMyTitC8-RsYUxdkS0Tss3MSSUQ2mVgsYXG9iUyUcexAALyx2BRXOpXBtBQGCCdTAJAMNBIKC4AGVxAI6uJoW1YV0EaAkbZljEwkoVXYws4-EsCQgrB5aHE9Ylpok4slcbSsvSDoyiMyziVmOzOdzefzeULqhJJI0AOqiADCPAqwsUqhh2jh3URiHVkSsI3JzgpYTW5J1ZmTDlNOKmXzNxrsdIZRzthQdYM4HK5PL5VAFQqqFVEAgD4gAkkJ2+IAJqiJgVACqVQAIlLNJHZT1YxEE4mNSm02EM3FHI5aKlMRqcTibJb9rlSycWY7LtXXXWG1wmHV23xRzw+7J5IG6oJxHwx+HpZP4dOEHGc6Go4xoaoaYTLsEiAWDYtDJGEixxFi6rDMaxY2ke9qgmyVaOqyYB8MYujXBAEAsGAXD3l+rQTp0f4xvM5KOIMdgDAkXiOAmKQ2DqKphKiYzOKaIFuKmFjoYeQLlthTq4Yw+GEcRjqKSgAAKbAaAArhoXABgIVQBnwPDju0v7RvK5jkritBYl4qzOMxzgDFYvFiQaZIwTEiwWKuEmAky0n4WeeHKURKAKWF6laTpTDtlU7bCpIJkyvRFmMdYsEJKmqq+KxbiJDq5JrEMmLOOsaxTIkax+bax4VjhVwhYwqkYGwJBwLAJFkRRI51AIvrJWZcomOYiwRAkiT8Zq-FWJNvF7rO9ggUaFh2KsNWYYFp7sk1BAtW1HVdeRvAhmGNGmXR5kjfMmoOBNyRWFiEE4pBcxYo4i12FEKrJpqUwbVJIJBTt8mOvt7WwJ1FCkcdvpxYNl3DUi702WSEEIZ46OzfNH2REtiQrWt4lWiWgMnpWjWg81rUQ51sBkJwpY8rAmksEKABCrYANISM2ABSAiik0CNRsNcyrVVtBCXqZVOVMCY8ddlhWAaiRfTY-RE7Y3gZCTGFk-VsmUwQ+Hg4d9OM4wzOs0K-DCGIUgyHIZ0Roj-5mGtqJCUJSFqvxLiFbltB7rEzl6ohYQAwFQPbXJJsoJpGBUNQUBnhoLBoEEYAYGeHBoHCVBQMK2cAG7Z1wqk8AIPb1KIACKg58I3ItTgxPkDFLrFJBrH2OHY6y8cmKv8T5bjTJqMFR2WMcU-hHKJ8nhdpxnWc5+yecF0Xpfl5X1e1w3TcO82Uh+nF2At6l13kquTizYaE8uJ4ARQQgWKxJEZXjKtqq2EsU91TJYK8kE5JxTsvTO2dwGrwDGgKg4gF4VAwOIMgrVuC7xrnUCQg46hVAvldXo6wkhDFXKtH2ms-C8TXEqWayYlAJAsGrf+WFgZxzoCAxeqd2TpwgWvKs3DoGwPgUnRByDUEVyrhg70fo8FI2gp4YkqZwJfDVuqUYlCXDBxoSqehjC9aSWjuTBqc92FgK4SvSBZieEwLgQgpBKDyjCi5u2VSMj-zrGshBGCQk1xpHNIPVUNkCbUj7mVMIiREhMK2rPPCJil6WNXlA7O1ihFUBEfY7gFRVKqWqPecQ9dG7N2-LRUWbjcSDFVIkJIGoe5rWfm9VasFXADEqTscYHh9zWn0dPQxRtjEL1MXw8xvCrj8OzqIzgFQqAsCCOIvemCT4VAGkUi6JS26qnXD4N+q56FYl4gkWCSQzTvRaWuCJej-LdMNkA+O-S4mDJ4YkuxqDJnTJFE4lxyyUr4OgjYBIwcnIFg+l9VMBUX6pg2FLBIowPB7m+CMSJM8jExNuZw+5CT4ljPSS8mZmTslVFyfkw+ri26zUSHBdUH1Hr8XGLxNYDg1wQQJn4dwCYEU9OuWwlFjzHkpIEMnPAaBZRcAgAYOgDwxX6wMVckGNzQF3JGUMnlC8+UUAFbKYlaUIIpBspiPcpzv6VPmtqlU-RrDaL3EWc5tVmGx2NpyuVqKFUPIxUg5V-LBXwloBvFAI5BVoC4COAQYpRBvkMp2T8Gqr5LDJRsJYOVJrMTiDqGIbg0RjAYRrTEgk4hsulaw+eDruUut5e62UXrdBkAgBgNAecWAVGeMzNgicIZcEjQQsYEQCa4ifkhNICZk0IVghS1YMRyQUjOQeC5ACWF2oLRwotaKxlutVR6gwtAGQqrVfCO44raAvDeJ8X4-xJWXMATK+186XVKqTpu1dVB102lveqz5Q03GrnXHuSp6xXAa2mMm1wKtH6hz1I9OhOarWbURb05Fhar3FuXVutdeA2BlxgRgCA4g2DiDQAAI2OvcdAjw92vGzu8VcR7SZSrPfm2JjraCjOGfRoZJaV1luQ6hzAGGsO4fIm26Cq4IjRE-eO8JSRk1IXXGkL4a0wkwUnhBg21HZ20YXU61eLHEP3pIJxkccBORsCCCnVtL63Ztw7XBUlqZGWVJci-Q565VzuDSKuNwZpc1Kb6bBxdjGGMabvbQbT6HJnYbwxRPjCAfJxi7ZNMdonbNzCciMYOBNPC4jcAwzi7mZ2ecvd569VAn2epgCgKoYAOBoYgMZ86XzZERfM9FqzYSbM6mTPxTudDkJeGsJayd1qolIuAVy9kGktA0CoCgXO+c9CF2LhgMuGBKhZJyVUPJB9CnVdfQxBCELJrCVWiBD6xpaWS1hRSMYixNhhF1r1yD7Lz1zoGVcEborxtnme2NlAyTbHjIyUt-FK2sE4PCwhSaBo0gOToZ5XwSawUeBVj4X2JDFS-Ky7anLj3aDvbAK94bGhRvY8+4I776TZmSLWy7H8pnNUeFRGkDWAw-ChzqYgEFgxTtrS1Jd67nSp02uiYNrzT28cvYm7j-H42-NCpFWcXdlHT3ZZg7loX4vRdVixxLhDd7wv09go9Hwk17BITWPFlnCYIh9rKhVSkbhUf89lUrzHwuPtvadwTyXRWwCE-QyKPgeS9J1BHKIbJwpuztmqMDziywEIDFVKMbwHheLGhVpU6YqZ48QQSLbgb9uMfq9V8rkX7u10cArVWmtaA60NrgE2jALbgeTRVk5BCOIadrRN30VUgnmIxDVjBb4Hgs-QYFw7vPLuVdF-vRu0t26COCqeCRj4XwKMnunWjxXufXc47V5vlAE+H25EKwYevaQLPMsVPxLNybSGRHCcaTYdgnLVQU1RhXw+N8q7H4XzXbGUNgAq5hkLfDXdfdUjJfZfLpVfO3C9d-EXT-D7PfdjP-TjAAnjMAevBhOCDUNwdwbwWPZNPcZPB-HEBhawFwdwQfDlB7eVR3D-MXL-G9afNdQLCAXTVAVqQzQuKrV2VZTVSpc3LwfuNaZpEYcTVaOCD6CCLMdxGwCg+7FTOg53BQt3b-T1Zg4LVArgynHg66MJTENEAQ1aHYBhEQuzPg+MRLHwAQ9aZ-eXNfN-ag0fJQjXBg1jD3ErMrCrTQ4pVuXgvQ74ewQw4QmHBLNIYkR6SpKqTwQ0MYbnOXSA7PaA6gvAVmCgBge9KgNgAQQUCgMuEUMUCUUQQgQcHgdsWQXBEzbQ3oKlGyaNZMOPfuGYMFFUQYXEVMByFwJiTEWQmjIbKsZIlgVI2BPdbI3I3FZbVbApCnbwy+XoFNNNbtPue-HvdvLVFoj6WIKhToyOGw+IofHPJIlItI4YvQXI9BfeSY8LFwYkTiKqDUEYGIIg1yDuVonySpIFNabokZDAMADQTACiUUcUSUConwnQ1rSIK7fuTEZIQ5QqOTKWCkMkWo5lT4+jb4347464ZOIUcLQQ5LECSaCkTEL4ZwDMWIVNL6GFZiTYUYcDG7RTbLDQNEv4zE24BQCwDbKnK+DwMlBCPiL6PwJyfEF+SwH9DcEDewFLawTPHYvnIxRkn45k8gXkAAa1LHbEqxxJvgpQFOmCWG8gzBGB5NcwLENMWBRPlPRLoCVJIFVMYHVNbXZO4JBN6AgnsANA1FiBgkmgSHbzMENJsmNPCVNNpJ5z6ygzTiZIxLlyYDYAwDwF0jfCDTEDOOaGBJmOggYWzCWmMNWExleksjWGWCDPCQ1DVjoRcHNMjLoAACs2BqBfQK17SvRMl7wcTrIhJjRSoDt9sMwwkFFbBwjvhY1YiV9ZTekLTFSGZtAwAjw2AIA6BIQKAK8Ez3wxASiqguZgdB1g4Nh1QiDVRMQDTMoBhogthY8ogJ1Qzbs80viFSMTyA2BpzZz5yWS9BlzQxxQAwko0zvlX5VRiQfIKQMpR5SojywdXijQlgzRfARyICxyIy7yrSpzYAZz8g5yFysSlyWBrwmhCickexgdpoDRiCpTLdTRgjzA1pg4cRTQ1Yzsh5KzEKAtkLULjh0L10NBqAaAFsbw7wHwnxnZXxVzqInT0zX5XTMDPY5MyokJA4iySFXNwitxGLLTmLHyULnyxUwBMBywoBKgagWzyiOTKjYxPBks-Y1hbJQU3onJwTz80xkgPBti6SX80cJz7yWLNKAsNIggeBqBlSuBfQBBux+xbwqJhRwtTRxpYh+46EHJ7B+4r8yVMRPAhJrA9czQOk4j4KuEqy1Kny0KXyULyJBRAD-ijI+A2wJABB2Z+BgdVwHA1oUsoL+g0gdQyQ7pOIvAohwgdhYLed+txy8qHyCq2KiqwASrd8NDYoeAeBRBOYq4DIpiVlnSWdjQyUk9VpHodwfAMwvoSRwknIPBkwYgUcZTBqELVKRqNLCqtLJqyrdJgxQwI8MDr4x5VhxgQJSSksJTaK9ylgrsVLJz1LWKiB2LORYFYBnhIFYz4ygxTp68dhxC1Z001xrcMxiQpgnoNggV7Af0pSgaMSGMAxvi71Sda4qhBKAxEyPxA9hRBwAxDJhRhQmBijHxwsYJ9rjQxhyy48VRmd5hOJGr+gfBu8EwHJ+qwy7s+E8ribSahUUzRBKaXxqb3ww8ah6hGhUzjLVqIsNgNrjRrBItVp0xhS0wiyGshJWIXNCatKdLTgoAKgd9YAuA4ouwPxAwq52x5ARKtDdbyRvB4wtUvpPJnNSSPFFhSopgs1f1bb11tLa8HanaVcXa9IlrjIfzatYh+h9CdgFw-Bbj8z5hUw4IUgYIPrqkkw46UL7aU5k6RcXbQw6gRBME3wASJQcTkwnBmj+h9a6cLAMxU0tr+50slgIdiYXLbDZ53K2EMAKBIAAwM5VVIB2wqAS5dAKJOYAweZxB+ZBZd7tbRLfy1RddmIojDQYIPoMxvBBgypE0rbdzTQ46CBIY0AYABAcMm0UBmYbRHqEbM7-wfBlhDRfAv1b8kIKL5gyRk8PA-AsQkhGcesrz6S0dvi5cvCVqxKtUIhqUEJRgHpIHu9g5Rg1oac9UKQUSWYMBviqB5yFtZ8iMQCPhWq-hsqLr2QqGaG6HwtLAfJk86EaEvBvhWidRWI2cHI2k-BtYB9zqgYE4UBYysKjp-jJBFkQ1ii+AIqAGGIzBJCyVVgqTRMb7IHlZ3AP4UgYtM0YhJbrzOUFG56K9lGd1CN58D15FWHRzAp5HFHHHoZuoeHXSIg8bdxL7ZovBSTH9iFcRWqFZrDJ7p1vGHGWB8I6hWY4A-7Qx1H+AtGdaxLLBiDAkNh-ZMR-DrLLIqknB+5kgKo9RvAstEmlGLYOB4F7GMmHZBwD6AmUZvBo1qRQ62qzaZohhuqzQHIsCzkrQMj5z4A2g2GQQj7atdHkwP01wthFhHonLw7Hoai1gYiyTYhPiFn3ZrBrIXAx5PBvBfABbLBVgyUKSHJDRvBHKJ7kHXLZ5IQjmdHyQAklh25kgLGNYymbopgSQAiRhxg48zTZHpargXRax3RBRPm0o-TmIbIXBDsNgJHwnhTkxBhYgIT+JKlDcbGUGoCkWlYNi7mhaJ4ykGESSX5jDBhs0NZISQ6srPHwz7tQpdByWkRs7iQpGiCMs1gjsGXxgHBSEurcQu15N4mcr81uXwo-HyJeXynQdBWaXmI6XaVioDz1hglyN2W4L2GFXGAVIIpdAoptJVX0pTQ0ROI9VOaqoB6wU0w0RbIIHETTqUTdowAzZIYbWPYYgomJpTrraVjusnA6ELRQ4poQy5mYW54wYaZDplWwBA2HW00khohzsQ4ViNR1xtFOI1xsQ76fWqY9oU3IZ10GYOAmY4AbZA3RMQ3u5OaBHB4u6iCIJf40Zy2TZk2Dpq2mn62WY2ZaB2AULCAOo3702-a8mohG8zRfl1RfktXeIoh1xXBramVfBNQ+2ZJ-W6Za2R2bZy0qAp3X6YBA2YhiRNZ+JvgpgOtYh121wpY-ozQfBd2kGE2byk3qZB2j3LYCBrYx2y8OAL3YAZ2m3A7XjQ223DQX3N332d2iD92qDHUbWQV5ji3WI+5li5KcGH8iTvFB0jWBrOWejBcmNnVOAbW-AHBNkYhtllQYheIvAcGPpEsiRVn42OXE319qCGNJtN5Zt5sbWfIvg4IqpnNraaTFY3o5i9QVQUgdg+5pS5WTXlNei1MLFvMvthEnlaO53fzut1wqo4GXArtCT6W3o+qhh1h+5qkAb+I0P5C8ti0sUpk5hpiTO+00RbBPEP2uqBa35lg9QJZVQYVu3XPtPqP0VvMJ9xO9RGq+4+CJpIui7x1URWJJCUr1YSW3mEj0PVM4ul0XDNMvUptfV0BxPVwyVoGVPfl3BZZk1Nhlgm9flO8ZKCup6iu3OdOfNmMVDi9S9q1a161G1m04BausRS6+5mJ5vsW5giScGrsQISG+I9QYuqOhP4Nyv-Mp9XCroas3135zOzQKpSyGF8CiFQ5+gxh+51gevdjKD+vSvBueEEDf9-9uNQtauYIP4kI1YcCSn28b6wvspgeBSNZePjWKOtOdvFU9uCtGCtMdM9N2CU4ku-ANxUuY74Jkxk0NhiQaT0tOIIJe5tuHdduEvhu0egs4FUDavphO4CYsxxgVOi77A3TLtBT+Jm9nv5WEfqekfaf9uy1itStytONmfURzuqolgH90QWsA77OyoDyojHoqeMcaeBu99qBxBl6v7Ze4JDCFfNQnINYWtTUbI6VwlvhttBfNP0cHCd9LhMOnIyU6dTVGcnIQv2O0WFwlgYeyRtfXfaCqxvUU5RPs5MO+4HA76cRI9OyXX6kxCGVe7Y8oTnLXneu9jEi6NHDt8Vd9PUlDOOA4+2s1gPoiSKTFgbOWcwko8cpLcbisQnf4eXfC+3enDd86fMOjlIhq+4ceqR69ltmcRwi5ZljnAw-u+I+C94C6f6BPcKs4+yRMCIcKRe5HLKFbLpY5ZakqoHI5+4CCcz-nCUejv70S8UBK0xuK8Jvq8puZmfPasMZURvAVQCZnp3BdkwUiYaaL6HQkuzuBDQp-Xvhfz77i9PUh3TTHHwcjEM9wowapE1wb4d5ogG4SpFc2sA+wIBxfWAr3y+4cZ0MKBP7sZ3f7k9iK5dUOGMFNADo-kvyByCjVTxJB8Bi-c-kQOX7MFWC+mDglADj450PIj8BMHiGfZ2ZXAPJHYN8Bor3cXmP7DzAJ3n6ECCBS-GAUwU4zqFyBb-f8CDhVikNsBCaNwIsCJ5eBTeX-M3K0RtzQtf2SgqAVAL3yS8PCMvCgboOWgbho0EpBCMYMgZUhJMW1KIFtUzLsCaCKgjgZf0Pz3oDeRvTSCgDj4EwPBQkLwWQRMEvwyoe4GyMhBHiOQIIIQ-ooMWGgnctsowbDlEFw5fwCYbHCkJU1oT80YK8gvjrYPsJ0Z8hRxDIlkROKzsdBDEcWhuHBzMRJoAjKqDq0LZEdv4AGKqHkMOJDFSAnQm1iMGWAMpDQD7YFNqDBT9AveUVDWLUw5y215hLPEBiE3Ab8RvqwbY6u0WLbWBNgcdD5q4IYhrgBIFJRHBESmARMc6ixCWmlmaQyEbBHmGesxRVJqkIANrNWMsBgiMo-eIEAQhmCFpRtB0SQa+MaFn6-CGSeVaMrDXE6ahG8ixBqmrEWBrRSSyEMUuHFJR0tv2jQv4XlVrL1lGywIu4WlFNDLB7m1ILwATFSFzBMwCYcEl9GLYdUaQsPcjom3+HXVQahAdCuJwfwqwHuMsBMBSgTzClqk5KcJO+mpAIlwkcdEUV5UXIV5MOo8OyqxAFL95Vwe1T-jRSOrgs6EPwjTp32FGeVbqHFLirH3pE6EM8H8B4cxCmhRBB4tvKzPfhr7+ENRdosanbUTpY9nRBCXwJlBgoAZNkj8eaLBEiyT8GUV2fvIGJBpeU+QGgXyv5Uw5AVce0QXEBzy8QC13A9KbOprDKhqxw4aY0amDXGr3Ume4YlnDjSlibBSUmwLyCYyoq-VoK9FKzjWJurBjqwkNaGjnAxFNjX4uYZGhznWB4d3ApJGyCu2MLhwGESxOOnLW0ogkihaUYYJJghY-p30v0PaiXS6zohRmSnK0bnxe65UmKNdUMYXHrofZX+mDX8niPchjR3E0aIUuLDl6PsCYS7M3L4Djqch56EARevnAIAQBV669R4JiKRoOR0smoL-j3GvpJY5MRLePhmmRHWihReVF+pB3fqf1YhP9XIDa0QhScHm0wXKGUN7JXZUYpCFIMQSpCXkFB2WNBiekDaq8vg6LVpCdVTDt58w+g1rBqBPIEkGhcPRNmADChMBWoeAUsJxKologWWVUF4R6XapI11gWqJpDsBvqUNE4XDJ0d0ORbkgfA7rT9tSEmiuB-+4sOnOIX1a6pPA5IiSWcAaY6iJxujC1DuRLbbANmj0Ukr7DRCClkgj3SfvU1iE+NkmabQNvAzZyrNvA6zO4kXUsB40pYgEx-A0S14ojXJyTR0Kk3IjPjtxFLVIPCQIKWVXAA8M2gBkXGrj-YD3XYFlPClJMa2nAFprGWilSZ-Od7H0i4FxCEjwkYOS5h+0iwaxMgmQIAA */
    predictableActionArguments: true,

    id: "startGameMachine",
    tsTypes: {} as import("./cardGameMachine.typegen.d.ts").Typegen0,

    schema: {
      events: {} as CardGameMachineEvent,
    },
    type: "parallel",
    states: {
      gameFlow: {
        initial: "init",
        on: {
          LEAVE_THE_GAME: {
            description: "выходим из игры в таверну завершая все процессы",
            target: ".exitFromGame",
          },

          ON_ERROR: {
            target: "gameFlow",
            actions: {
              type: "checkAutorization",
            },
          },
        },
        states: {
          init: {
            after: {
              "100": {
                target: "tryReconnect",
              },
            },
          },

          tryReconnect: {
            on: {
              START: {
                target: "game",
                actions: {
                  type: "actualizeAchievements",
                },
                description:
                  "Если игра найдена то стартуем её и актуализируем ачивки",
              },
              ON_THROW_CLOSE: {
                target: "prepare",
                actions: {
                  type: "stopWebsocket",
                },
                description: "ели ошибка то тоже переходим к созданию новой",
              },
              NO_ACTIVITY_FOUND: {
                target: "prepare",
                actions: {
                  type: "stopWebsocket",
                },
                description: "ели игра не найдена переходим к созданию новой",
              },
              FRIENDLY_GAME_CREATED: {
                target: "#startGameMachine.gameFlow.prepare.searchingOpponents",
                description:
                  "Найдена игра по ссылке\nпереходим к ожиданию игроков",
              },
            },
            entry: {
              type: "reconnect",
            },
          },

          game: {
            type: "parallel",
            states: {
              gameExit: {
                initial: "iddle",
                states: {
                  iddle: {
                    on: {
                      END: {
                        target: "gameExitPopup",
                      },
                    },
                  },
                  gameExitPopup: {
                    on: {
                      CANCEL: {
                        target: "iddle",
                      },
                      FINISH: {
                        target: "#startGameMachine.gameFlow.surrender",
                      },
                    },
                  },
                },
              },
              gameProcess: {
                initial: "iddle",
                states: {
                  iddle: {
                    on: {
                      DRAW: {
                        target:
                          "#startGameMachine.gameFlow.game.gameProcess.showGameResult.drawMessage",
                      },
                      LOSE: {
                        target:
                          "#startGameMachine.gameFlow.game.gameProcess.showGameResult.loseMessage",
                      },
                      WIN: {
                        target:
                          "#startGameMachine.gameFlow.game.gameProcess.showGameResult.winMessage",
                      },
                    },
                  },
                  showGameResult: {
                    on: {
                      BACK_TO_JASTOR: {
                        target: "#startGameMachine.gameFlow.restartGame",
                      },
                      LEAVE_THE_GAME: {
                        target: "#startGameMachine.gameFlow.exitFromGame",
                      },
                    },
                    entry: {
                      type: "getAchievementsUpdates",
                    },
                    states: {
                      loseMessage: {},
                      winMessage: {},
                      drawMessage: {},
                    },
                  },
                },
              },
              turningFlow: {
                type: "parallel",
                states: {
                  playerFlow: {
                    initial: "waitingServer",
                    states: {
                      waitingServer: {
                        on: {
                          PLAYER_QUEUE: {
                            target: "playerCanTurnOrThrow",
                          },
                          PLAYER_QUEUE_TO_THROWING: {
                            target: "playerThrowOnly",
                          },
                        },
                      },
                      playerCanTurnOrThrow: {
                        on: {
                          PLAYER_TURN: {
                            target: "playerTurnAnimation",
                            actions: [
                              {
                                type: "selectCard",
                              },
                              {
                                type: "setActiveCardStartPosition",
                              },
                              {
                                type: "turnWithCard",
                              },
                            ],
                          },
                          PLAYER_THROW: {
                            target: "playerTurnAnimation",
                            actions: [
                              {
                                type: "selectCard",
                              },
                              {
                                type: "setActiveCardStartPosition",
                              },
                              {
                                type: "throwCard",
                              },
                            ],
                          },
                          SKIP: {
                            target: "waitingServer",
                            actions: {
                              type: "skip",
                            },
                          },
                          OPPONENT_QUEUE: {
                            target: "waitingServer",
                          },
                        },
                        entry: [
                          {
                            type: "playerTurningNotification",
                          },
                          {
                            type: "nextData",
                          },
                        ],
                      },
                      playerThrowOnly: {
                        on: {
                          PLAYER_THROW: {
                            target: "playerTurnAnimation",
                            actions: [
                              {
                                type: "selectCard",
                              },
                              {
                                type: "setActiveCardStartPosition",
                              },
                              {
                                type: "throwCard",
                              },
                            ],
                          },
                          SKIP: {
                            target: "waitingServer",
                            actions: {
                              type: "skip",
                            },
                          },
                          OPPONENT_QUEUE: {
                            target: "waitingServer",
                          },
                        },
                      },
                      playerTurnAnimation: {
                        initial: "waitData",
                        onDone: {
                          target:
                            "#startGameMachine.gameFlow.game.turningFlow.playerFlow",
                        },
                        states: {
                          waitData: {
                            on: {
                              DATA_RECEIVED: {
                                target: "withdrawalOfResources",
                              },
                            },
                          },
                          withdrawalOfResources: {
                            always: {
                              target: "startAnimation",
                            },
                          },
                          startAnimation: {
                            after: {
                              "10": {
                                target: "moveCardToTable",
                              },
                            },
                            entry: {
                              type: "startCardAnimation",
                            },
                          },
                          moveCardToTable: {
                            after: {
                              "670": {
                                target: "cardDestroying",
                              },
                            },
                            entry: {
                              type: "cardMoveAnimation",
                            },
                          },
                          cardDestroying: {
                            always: {
                              target: "cardOnTable",
                            },
                            entry: {
                              type: "nextData",
                            },
                            exit: [
                              {
                                type: "startCardDestroyAnimation",
                              },
                              {
                                type: "arrowAnimation",
                              },
                            ],
                          },
                          cardOnTable: {
                            always: {
                              target: "getNewCard",
                            },
                            entry: {
                              type: "nextData",
                            },
                          },
                          getNewCard: {
                            always: {
                              target: "inTimeout",
                            },
                            entry: {
                              type: "nextData",
                            },
                          },
                          inTimeout: {
                            type: "final",
                            entry: {
                              type: "nextData",
                            },
                          },
                        },
                      },
                    },
                  },
                  opponentFlow: {
                    initial: "waitingServer",
                    states: {
                      waitingServer: {
                        on: {
                          OPPONENT_QUEUE: {
                            target: "opponentCanTurnOrThrow",
                          },
                        },
                      },
                      opponentCanTurnOrThrow: {
                        on: {
                          OPPONENT_TURN: {
                            target: "opponentTurnAnimation",
                            actions: {
                              type: "selectCard",
                            },
                          },
                          PLAYER_QUEUE: {
                            target: "waitingServer",
                          },
                        },
                        entry: [
                          {
                            type: "opponentTurningNotification",
                          },
                          {
                            type: "nextData",
                          },
                        ],
                      },
                      opponentTurnAnimation: {
                        initial: "getCard",
                        onDone: {
                          target:
                            "#startGameMachine.gameFlow.game.turningFlow.opponentFlow",
                        },
                        states: {
                          getCard: {
                            on: {
                              SET_CARD_POSITION: {
                                target: "withdrawalOfResources",
                                actions: {
                                  type: "setActiveCardStartPosition",
                                },
                              },
                            },
                            entry: {
                              type: "getOpponentCard",
                            },
                          },
                          withdrawalOfResources: {
                            always: {
                              target: "startAnimation",
                            },
                          },
                          startAnimation: {
                            after: {
                              "100": {
                                target: "moveCardToTable",
                              },
                            },
                            entry: [
                              {
                                type: "opponentTurnStart",
                              },
                              {
                                type: "startCardAnimation",
                              },
                            ],
                          },
                          moveCardToTable: {
                            after: {
                              "1000": {
                                target: "cardDestroying",
                              },
                            },
                            entry: {
                              type: "cardMoveAnimation",
                            },
                          },
                          cardDestroying: {
                            type: "final",
                            always: {
                              target: "cardOnTable",
                            },
                            entry: [
                              {
                                type: "startCardDestroyAnimation",
                              },
                              {
                                type: "nextData",
                              },
                            ],
                            exit: {
                              type: "arrowAnimation",
                            },
                          },
                          cardOnTable: {
                            always: {
                              target: "getNewCard",
                            },
                            entry: {
                              type: "nextData",
                            },
                          },
                          getNewCard: {
                            always: {
                              target: "inTimeout",
                            },
                            entry: {
                              type: "nextData",
                            },
                          },
                          inTimeout: {
                            entry: {
                              type: "nextData",
                            },
                          },
                        },
                      },
                    },
                  },
                  muligan: {
                    initial: "noActive",
                    states: {
                      noActive: {
                        on: {
                          START_MULIGAN: {
                            target: "active",
                          },
                        },
                      },
                      active: {
                        on: {
                          OPPONENT_QUEUE: {
                            target: "noActive",
                          },
                          PLAYER_QUEUE: {
                            target: "noActive",
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },

          prepare: {
            initial: "init",
            on: {
              START: {
                target: "game",
                actions: {
                  type: "actualizeAchievements",
                },
              },
            },
            states: {
              init: {
                always: [
                  {
                    target: "checkGameId",
                    cond: "withUserName",
                    description: "если пользователь создан",
                  },
                  {
                    target: "startGameForm",
                    description: "иначе создаем пользователя",
                  },
                ],
              },

              checkGameId: {
                always: [
                  {
                    target: "joinWithId",
                    cond: "withGameId",
                  },
                  {
                    target: "chooseGameMode",
                  },
                ],
              },

              startGameForm: {
                on: {
                  CREATE_PLAYER: {
                    target: "playerCreation",
                    actions: {
                      type: "setPayerName",
                    },
                  },
                },
              },

              joinWithId: {
                on: {
                  ON_OPEN: {
                    target: "searchingOpponents",
                  },
                },
                entry: {
                  type: "playWithGameId",
                },
              },

              chooseGameMode: {
                initial: "initial",
                states: {
                  initial: {
                    on: {
                      CREATE_LINK: {
                        target: "spinner",
                      },

                      SEARCH: {
                        target: "searching",
                      },

                      FOR_MONEY: "selectTable",
                    },
                  },

                  spinner: {
                    on: {
                      FRIENDLY_GAME_CREATED: {
                        target: "copyLink",
                        actions: {
                          type: "setInviteKey",
                        },
                      },
                    },
                    entry: {
                      type: "createFriendlyGame",
                    },
                  },

                  searching: {
                    on: {
                      ON_OPEN: {
                        target:
                          "#startGameMachine.gameFlow.prepare.searchingOpponents",
                      },
                    },
                    entry: {
                      type: "searchGame",
                    },
                  },

                  copyLink: {
                    on: {
                      WAIT_FRIENDS: {
                        target:
                          "#startGameMachine.gameFlow.prepare.searchingOpponents",
                      },
                    },
                  },

                  selectTable: {
                    on: {
                      SELECT_TABLE: {
                        target: "#startGameMachine.gameFlow.prepare.searchingOpponents",
                        actions: "sitAtMoneyTable",
                      },
                      FILL_BALANCE: "transferForm",
                      CLOSE: "initial",
                    },
                  },

                  transferForm: {
                    on: {
                      CLOSE: "selectTable",
                    },
                  }
                },
              },

              playerCreation: {
                on: {
                  PLAYER_NAME_CREATED_SUCCESSFULLY: {
                    target: "checkGameId",
                    actions: {
                      type: "setUserParamsToStore",
                    },
                  },
                  PLAYER_NAME_CREATION_ERROR: {
                    target: "startGameForm",
                    actions: {
                      type: "setErrorMessage",
                    },
                  },
                },
                invoke: {
                  id: "startGameMachine.gameFlow.prepare.playerCreation:invocation[0]",
                  src: "createPlayerName",
                },
              },

              searchingOpponents: {
                on: {
                  INVITE_CLAIMED: {
                    target: "triedClaimedInvite",
                    actions: [
                      {
                        type: "stopWebsocket",
                      },
                      {
                        type: "clearGameId",
                      },
                    ],
                    description: "если игра уже занята отображаем попап",
                  },

                  CANCEL: {
                    target: "chooseGameMode",
                    actions: {
                      type: "stopWebsocket",
                    },
                    description:
                      "можно отменить поиск игры и вернуться к выбору режима",
                  },

                  SERVER_RESTART: "messageAboutRestart"
                },
              },

              triedClaimedInvite: {
                on: {
                  BACK_TO_JASTOR: {
                    target: "chooseGameMode",
                  },
                },
              },

              messageAboutRestart: {
                on: {
                  CLOSE: {
                    target: "init",
                    actions: [
                      "leaveTheTable",
                      "resetData",
                      "stopGameLoop",
                      "stopWebsocket",
                      "goToCleanCardGamePage"
                    ]
                  }
                }
              }
            },
          },

          restartGame: {
            always: {
              target: "#startGameMachine.gameFlow.prepare.chooseGameMode",
            },
            entry: [
              {
                type: "leaveTheTable",
              },
              {
                type: "resetData",
              },
              {
                type: "stopGameLoop",
              },
              {
                type: "stopWebsocket",
              },
              {
                type: "goToCleanCardGamePage",
              },
            ],
          },

          exitFromGame: {
            type: "final",
            entry: [
              {
                type: "leaveTheTable",
              },
              {
                type: "resetData",
              },
              {
                type: "stopGameLoop",
              },
              {
                type: "stopWebsocket",
              },
              {
                type: "goToTavern",
              },
            ],
          },

          surrender: {
            after: {
              "300": {
                target: "exitFromGame",
              },
            },
            entry: {
              type: "surrender",
            },
          },
        },
      },
      tutorial: {
        initial: "iddle",
        states: {
          iddle: {
            on: {
              SHOW_RULES: {
                target: "gameRules",
              },
            },
            after: {
              "500": {
                target: "gameRules",
                cond: "isFirstEnter",
              },
            },
          },
          gameRules: {
            on: {
              CLOSE_RULES: {
                target: "showTutor",
              },
            },
          },
          showTutor: {
            on: {
              CLOSE_TUTOR: {
                target: "iddle",
              },
            },
            entry: {
              type: "setNoFirstEnter",
            },
          },
        },
      },
    },
  },
);
