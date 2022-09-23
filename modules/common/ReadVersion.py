import sys, os

# read version file
def read_ver() :
    try:
        os.chdir(sys._MEIPASS)
    except:
        print ("in dev mode")
    finally:
        fo = open("./ver", "r+")
        version = fo.read()
    return version
