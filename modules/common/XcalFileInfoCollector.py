#
#  Copyright (C) 2021 Xcalibyte (Shenzhen) Limited.
#
import logging
import os
import json
import ntpath

from common import XcalGlobals
from common.HashUtility import HashUtility
from common.FileUtility import FileUtility
from common.CommonGlobals import TaskErrorNo, GIT_METADATA_FILE_NAME, FILE_INFO_FILE_NAME, COMMIT_FILE_NAME
import subprocess

from common.XcalGlobals import SOURCE_CODE_SUFFIX
from xcal_common.py.error import EFileInfoPjNull, EFileInfoGatherFail, ECommonInvalidContent, ECommonFileNotExist, \
    EFileInfoNoFileid

logger = logging.getLogger(__name__)


def _file_lines(filename):
    """
    Get number of lines of the file
    :param filename: file path
    :return: the number of lines of the file. If file cannot find or cannot be read, return 0.
    """
    if not os.path.isfile(filename):
        logger.error("%s not found" % filename)
        return 0

    if not os.access(filename, os.R_OK):
        logger.error("%s cannot be read" % filename)
        return 0

    i = -1
    with open(filename, 'rb') as f:     # open file in binary mode to avoid the decode error
        for i, l in enumerate(f):
            pass
    return i + 1


def _getmtime_nano(filename):
    """Return the last modification time of a file in nanoseconds, reported by os.stat()."""
    return os.stat(filename).st_mtime_ns


def get_git_commit_id(project_path):
    # TODO: need to improve with gitpython library.
    commit_id = None
    if os.path.exists(COMMIT_FILE_NAME):
        with open(COMMIT_FILE_NAME, 'r') as f:
            commit_id = json.load(f).get('commit_id')

    if commit_id is None:
        utility = FileUtility()
        utility.goto_dir(project_path)
        commit_id = subprocess.check_output("git rev-parse HEAD", shell=True).strip().decode('utf-8')
        utility.goback_dir()
    return commit_id


def _get_source_code_zip_file_id(upload_results, step_config):
    """

    :param upload_results:
    :param step_config:
    :return: the file info id of the source code archive
    """
    for upload_result in upload_results:
        if step_config.get('sourceCodeArchiveName') == upload_result.get('filename') and \
                'fileId' in upload_result:
            return upload_result['fileId']
    else:
        logger.error("no source code file id found.")
        raise EFileInfoNoFileid


def _get_directory_name(project_path, file_name):
    """
    get all the directory name in the specified file
    :param project_path: project source code path
    :param file_name: json file which contains all the file paths being preprocessed
    :return: set type object which contains all the directory name
    """
    logger.info("begin to parse the file to get directory name")

    dir_set = set()
    with open(file_name) as json_file:
        source_code_files = json.load(json_file)
        if not isinstance(source_code_files, list) or len(source_code_files) == 0:
            logger.error("source code file content is invalid: %s" % source_code_files)
            raise ECommonInvalidContent

        for source_code_file in source_code_files:
            # file path may contain .., normpath can make the path canonical
            source_code_file = os.path.normpath(source_code_file)
            if source_code_file.startswith(project_path):
                path_list = source_code_file.split(os.sep)[1:-1]    # only keep the directory info
                dir_set.update(path_list)
    return dir_set


def _get_filename_depth_map(project_path, dir_starts_with_dot_list: list = []):
    """
    traverse the project path to get the filename/depth key/value pair. The directory starts with '.' and
    exists in dir_starts_with_dot_list should also be included. Other directories start with '.' is excluded.
    only file's real path exists in project path will be collected
    :param project_path:
    :param log:
    :param dir_starts_with_dot_list:
    :return: dict type object
    """
    filename_depth_map = dict()
    base_depth = project_path.count(os.sep)
    # traverse the project path, include the symbolic links
    file_set = set()
    logger.debug("begin to traverse project path: %s" % project_path)
    for root, dirs, filenames in os.walk(project_path, followlinks = True):
        if os.path.realpath(root).startswith(project_path) and os.path.realpath(root) not in file_set:
            file_set.add(os.path.realpath(root))

            # currently only collect directory starts with '.' and exists in dir_starts_with_dot_list.
            # Other directories start with '.' is excluded no matter what os (windows, linux, macOS).
            dirs[:] = [dir_name for dir_name in dirs if (dir_name in dir_starts_with_dot_list or not dir_name.startswith('.'))]
            depth = os.path.realpath(root).count(os.sep) - base_depth
            filename_depth_map[os.path.realpath(root)] = depth
            for filename in filenames:
                if os.path.realpath(os.path.join(root, filename)).startswith(project_path):
                    filename_depth_map[os.path.realpath(os.path.join(root, filename))] = depth + 1

    return filename_depth_map


def _get_parent_path(relative_path: str, depth: int):
    """

    :param relative_path:
    :param depth:
    :return:
    """
    if depth == 0:
        return None
    elif depth == 1:
        return os.sep
    else:
        return os.path.dirname(relative_path)


def generate_directory_file_info(project_path, directory, filename_depth_map, file_num, version):
    """
    generate the file info of the directory
    :param project_path: the whole project path
    :param directory: the directory whose file info will be generated
    :param filename_depth_map: the directory name depth map
    :param file_num: file number
    :param version: git commit id or zero for directory type
    :return: a dict which contains the directory file info
    """
    depth = filename_depth_map.get(directory)
    if directory != project_path:
        relative_path = os.path.relpath(directory, project_path)
    else:
        relative_path = os.sep
    file = {'fileId': str(file_num),
            'fileName': os.path.basename(directory),
            'type': "DIRECTORY",
            'depth': str(depth),
            'parentPath': _get_parent_path(relative_path, depth),
            'filePath': directory,
            'relativePath': relative_path,
            'version': str(version),
            'checksum': str(0),
            'fileSize': str(0),
            'noOfLines': str(0)
            }
    return file


def generate_file_info_by_traverse_project_path(project_path, filename_depth_map, is_vcs_project, xcalbuild_path):
    """
    :param project_path:
    :param filename_depth_map:
    :param is_vcs_project:
    :return:
    """
    version = 0
    if is_vcs_project:
        version = get_git_commit_id(project_path)

    number_of_files_without_permission = 0
    total_line_num = 0
    file_num = 0
    files = []
    file_set = set()

    logger.info("begin to traverse project path: %s" % project_path)
    logger.debug("xcalbuild_path : %s" % xcalbuild_path)
    # traverse the project path, include the symbolic links
    for root, dirs, filenames in os.walk(project_path, followlinks = True):
        # currently not collect directory start with '.', no matter what os (windows, linux, macOS).
        dirs[:] = [dir_name for dir_name in dirs if not dir_name.startswith('.')]

        if os.path.realpath(root).startswith(project_path) and os.path.realpath(root) not in file_set:
            file_num += 1
            dir_file_info = generate_directory_file_info(project_path, os.path.realpath(root), filename_depth_map, file_num, version)
            files.append(dir_file_info)
            file_set.add(os.path.realpath(root))

        for filename in filenames:
            if filename.endswith(tuple(SOURCE_CODE_SUFFIX)):
                lost_file = False
                depth = filename_depth_map.get(os.path.join(root, filename))

                # Do not check the source code of xcalbuild_path
                if not xcalbuild_path is None and root.find(xcalbuild_path) > -1 and filename.endswith(".h"):
                    logger.info("This source code is owned by xcalbuild, please do not show it to users")
                    continue
                if os.path.islink(os.path.join(root, filename)):
                    logger.info("This source code is link file: %s" % os.path.join(root, filename))
                    continue

                if depth is None:
                    logger.warning("source code file %s does not exist" % os.path.join(root, filename))
                    lost_file = True

                if not os.path.isfile(os.path.join(root, filename)):
                    logger.warning("file %s does not exist" % os.path.join(root, filename))
                    lost_file = True

                if lost_file:
                    continue

                file_num += 1
                file_path = os.path.join(root, filename)
                if not os.access(file_path, os.R_OK):
                    number_of_files_without_permission += 1
                relative_path = os.path.relpath(file_path, project_path)

                if not is_vcs_project:
                    version = _getmtime_nano(file_path)

                files.append({'fileId': str(file_num),
                              'fileName': filename,
                              'type': "FILE",
                              'depth': str(depth),
                              'parentPath': _get_parent_path(relative_path, depth),
                              'filePath': file_path,
                              'relativePath': relative_path,
                              'version': str(version),
                              'checksum': str(HashUtility.get_crc32_checksum(file_path)),
                              'fileSize': str(os.path.getsize(file_path)),
                              'noOfLines': str(_file_lines(file_path))
                              })
                total_line_num += _file_lines(file_path)
                #else:
                #    log.warn("generate_file_info_by_traverse_project_path", "file %s does not exist" % os.path.join(root, filename))

    return files, number_of_files_without_permission, total_line_num


def generate_file_info_by_analyse_file(project_path, filename_depth_map, dir_starts_with_dot_list: list, file_name, is_vcs_project, xcalbuild_path):
    """
    
    :param project_path:
    :param filename_depth_map:
    :param dir_starts_with_dot_list:
    :param file_name: 
    :param is_vcs_project: 
    :return: 
    """""
    version = 0
    if is_vcs_project:
        version = get_git_commit_id(project_path)

    number_of_files_without_permission = 0
    total_line_num = 0
    file_num = 0
    files = []
    file_set = set()
    # traverse the project path, include the symbolic links
    logger.info("begin to traverse project path %s to get directory file info" % project_path)
    logger.debug("xcalbuild_path : %s" % xcalbuild_path)
    for root, dirs, filenames in os.walk(project_path, followlinks = True):
        # currently only collect directory starts with '.' and exists in dir_starts_with_dot_list.
        # Other directories start with '.' is excluded no matter what os (windows, linux, macOS).
        dirs[:] = [dir_name for dir_name in dirs if
                   (dir_name in dir_starts_with_dot_list or not dir_name.startswith('.'))]
        if os.path.realpath(root).startswith(project_path) and os.path.realpath(root) not in file_set:
            file_num += 1
            dir_file_info = generate_directory_file_info(project_path, os.path.realpath(root), filename_depth_map, file_num, version)
            files.append(dir_file_info)
            file_set.add(os.path.realpath(root))

    logger.debug("begin to analyse file %s to get file info" % file_name)
    with open(file_name) as json_file:
        source_code_files = json.load(json_file)
        if not isinstance(source_code_files, list) or len(source_code_files) == 0:
            logger.error("source code file content is invalid: %s" % source_code_files)
            raise ECommonInvalidContent

        utility = FileUtility()
        utility.goto_dir(project_path)
        file_path_set = set()
        for source_code_file in source_code_files:
            # file path may contain .., normpath can make the path canonical
            source_code_file = os.path.normpath(source_code_file)
            if not os.path.exists(source_code_file):
                logger.error("source code file does not exist: %s" % source_code_file)
                raise ECommonFileNotExist

            if source_code_file not in file_path_set:   # defensive, avoid add duplicate file info
                lost_file = False
                depth = filename_depth_map.get(source_code_file)

                #Do not check the source code of xcalbuild_path
                if not xcalbuild_path is None and source_code_file.find(xcalbuild_path) > -1 and source_code_file.endswith(".h"):
                    logger.debug("This source code is owned by xcalbuild, please do not show it to users")
                    continue

                if not source_code_file.startswith(project_path):
                    logger.warning("source code file %s does not belong to %s" % (source_code_file, project_path))
                    lost_file = True

                if depth is None:
                    logger.warning("file depth should not be None. file: %s" % source_code_file)
                    lost_file = True

                if lost_file:
                    continue

                file_num += 1
                file_path = source_code_file
                if not os.access(file_path, os.R_OK):
                    number_of_files_without_permission += 1
                relative_path = os.path.relpath(file_path, project_path)

                if not is_vcs_project:
                    version = _getmtime_nano(file_path)

                files.append({'fileId': str(file_num),
                              'fileName': ntpath.basename(file_path),
                              'type': "FILE",
                              'depth': str(depth),
                              'parentPath': _get_parent_path(relative_path, depth),
                              'filePath': file_path,
                              'relativePath': relative_path,
                              'version': str(version),
                              'checksum': str(HashUtility.get_crc32_checksum(file_path)),
                              'fileSize': str(os.path.getsize(file_path)),
                              'noOfLines': str(_file_lines(file_path))
                              })
                total_line_num += _file_lines(file_path)

                file_path_set.add(source_code_file)

        utility.goback_dir()

    return files, number_of_files_without_permission, total_line_num


def generate_file_info(project_path, job_config, step_config, xcalbuild_path=None):
    """
    generate the files information of the project
    :param xcalbuild_path: Current xcalbuild path
    :param step_config: Current Step's Information
    :param job_config: Current Job's Info
    :param project_path: where the project source code root path
    :return: file_info dictionary content
    """
    logger.debug("project_path: %s" % project_path)

    project_path = os.path.normpath(project_path)   # get the canonical project path. will change \\ to \ on windows
    project_path = os.path.realpath(project_path)   # get the real project path
    if not os.path.isdir(project_path) or not os.path.exists(project_path):
        logger.error("project path does not exist: %s" % project_path)
        raise EFileInfoPjNull

    input_filename = step_config.get("inputFileName")  # information of the source code files which are preprocessed

    is_vcs_project = False
    if step_config.get("sourceStorageType").lower() in ["gitlab", "gitlab_v3", "github", 'gerrit']:
        is_vcs_project = True

    file_info = {}
    if input_filename is None or not os.path.exists(input_filename):
        # if source_files.json not exists, collect the file information in project_path.
        logger.debug("traverse project path to generate file info")
        filename_depth_map = _get_filename_depth_map(project_path)
        files, number_of_files_without_permission, total_line_num = generate_file_info_by_traverse_project_path(project_path, filename_depth_map, is_vcs_project, xcalbuild_path)
    else:
        logger.debug("analyse file %s to generate file info" % input_filename)
        dir_set = _get_directory_name(project_path, input_filename)
        dir_starts_with_dot_list = [dir_name for dir_name in dir_set if dir_name.startswith('.')]
        filename_depth_map = _get_filename_depth_map(project_path, dir_starts_with_dot_list)
        files, number_of_files_without_permission, total_line_num = generate_file_info_by_analyse_file(project_path, filename_depth_map, dir_starts_with_dot_list, input_filename, is_vcs_project, xcalbuild_path)

    file_info['sourceCodeFileId'] = ""
    if step_config.get("sourceStorageName") == "agent" and step_config.get("uploadSource"):
        file_info['sourceType'] = "volume_upload"
        source_code_zip_file_id = ""
        if 'uploadResults' in job_config:
            upload_results = job_config['uploadResults']
            source_code_zip_file_id = _get_source_code_zip_file_id(upload_results, step_config)
        file_info['sourceCodeFileId'] = source_code_zip_file_id
    else:
        file_info['sourceType'] = step_config.get("sourceStorageName")

    dirs = [file_item for file_item in files if file_item.get("type") == "DIRECTORY"]

    file_info['files'] = files
    file_info['gitUrl'] = step_config.get('gitUrl')
    file_info['osType'] = XcalGlobals.os_info
    file_info['numberOfFiles'] = str(len(files) - len(dirs))
    file_info['numberOfDirs'] = str(len(dirs))
    file_info['totalLineNum'] = str(total_line_num)
    file_info['numberOfFilesWithoutPermission'] = str(number_of_files_without_permission)
    return file_info


def generate_file(project_path, job_config, step_config, destination_path=None, filename=None, xcalbuild_path=None):
    """
    generate the file which contains the file information of the project
    :param project_path: project path
    :param job_config:  Job's configuration, containing all steps, defined in AgentInvoker
    :param step_config: Step's configuration, singled step defined in the task's configuration
    :param destination_path: where to save the file
    :param filename: filename of the generated file
    :param xcalbuild_path: xcalbuild path
    :return: generated file path
    """
    utility = FileUtility()
    if destination_path is not None:
        os.makedirs(destination_path, exist_ok=True)
        utility.goto_dir(destination_path)
    else:
        destination_path = os.getcwd()
        utility.goto_dir(destination_path)

    if project_path is None:
        logger.error("project path does not exist: %s" % project_path)
        raise EFileInfoPjNull

    if filename is None:
        filename = FILE_INFO_FILE_NAME

    try:
        project_file_info = generate_file_info(project_path, job_config, step_config, xcalbuild_path)
    except Exception as err:
        logger.error("generate file info failed.")
        logging.exception(err)
        raise EFileInfoGatherFail

    if os.path.exists(filename):
        os.remove(filename)

    with open(filename, 'w') as outfile:
        json.dump(project_file_info, outfile, indent=1)

    utility.goback_dir()

    return os.path.join(destination_path, filename)
