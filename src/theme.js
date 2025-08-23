import { extendTheme } from '@chakra-ui/react';

const colors = {
  primary: {
    50: '#e6f7ff',
    100: '#bae7ff',
    200: '#91d5ff',
    300: '#69c0ff',
    400: '#40a9ff',
    500: '#1890ff',
    600: '#096dd9',
    700: '#0050b3',
    800: '#003a8c',
    900: '#002766',
  },
  secondary: {
    50: '#f5f5f5',
    100: '#e8e8e8',
    200: '#d9d9d9',
    300: '#bfbfbf',
    400: '#a6a6a6',
    500: '#8c8c8c',
    600: '#737373',
    700: '#595959',
    800: '#404040',
    900: '#262626',
  },
  success: {
    50: '#f6ffed',
    100: '#d9f7be',
    200: '#b7eb8f',
    300: '#95de64',
    400: '#73d13d',
    500: '#52c41a',
    600: '#389e0d',
    700: '#237804',
    800: '#135200',
    900: '#092b00',
  },
  warning: {
    50: '#fffbe6',
    100: '#fff1b8',
    200: '#ffe58f',
    300: '#ffd666',
    400: '#ffc53d',
    500: '#faad14',
    600: '#d48806',
    700: '#ad6800',
    800: '#874d00',
    900: '#613400',
  },
  error: {
    50: '#fff1f0',
    100: '#ffccc7',
    200: '#ffa39e',
    300: '#ff7875',
    400: '#ff4d4f',
    500: '#f5222d',
    600: '#cf1322',
    700: '#a8071a',
    800: '#820014',
    900: '#5c0011',
  },
};

const fonts = {
  body: 'Roboto, system-ui, sans-serif',
  heading: 'Roboto, system-ui, sans-serif',
  mono: 'monospace',
};

const theme = extendTheme({
  colors,
  fonts,
  config: {
    initialColorMode: 'light',
    useSystemColorMode: false,
  },
  components: {
    Button: {
      baseStyle: {
        fontWeight: 'normal',
        borderRadius: 'md',
      },
      variants: {
        primary: {
          bg: 'primary.500',
          color: 'white',
          _hover: {
            bg: 'primary.600',
          },
        },
        secondary: {
          bg: 'secondary.100',
          color: 'secondary.800',
          _hover: {
            bg: 'secondary.200',
          },
        },
        success: {
          bg: 'success.500',
          color: 'white',
          _hover: {
            bg: 'success.600',
          },
        },
        warning: {
          bg: 'warning.500',
          color: 'white',
          _hover: {
            bg: 'warning.600',
          },
        },
        danger: {
          bg: 'error.500',
          color: 'white',
          _hover: {
            bg: 'error.600',
          },
        },
      },
    },
    Card: {
      baseStyle: {
        container: {
          bg: 'white',
          borderRadius: 'md',
          boxShadow: 'sm',
          overflow: 'hidden',
        },
      },
    },
  },
});

export default theme; 