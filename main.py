from backend.app import App
from backend.cli import CLI
App.secret_key = ' '
if __name__ == '__main__':
    ok = CLI.run()

    if not ok:
        #start UI
        print('Starting UI')
        App().run()

